import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const MAX_PREFERRED_WINDOWS_LENGTH = 1000;
const MAX_NOTE_LENGTH = 1000;

interface RequestSlotContactPayload {
	preferredWindows?: unknown;
	note?: unknown;
	guideId?: unknown;
}

type StaffProfile = {
	id: string;
	email: string | null;
	first_name?: string | null;
	display_name: string | null;
};

type MemberProfile = {
	id: string;
	email: string | null;
	first_name: string | null;
	display_name: string | null;
	city_state: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

function getRequiredEnv(name: string): string {
	const value = Deno.env.get(name);
	if (!value) {
		throw new Error(`${name} is not configured`);
	}

	return value;
}

function getRequiredBaseUrl(name: string): string {
	return getRequiredEnv(name).replace(/\/+$/, '');
}

function truncate(value: string, maxLength: number) {
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function optionalString(value: unknown, maxLength: number) {
	if (typeof value !== 'string') {
		return '';
	}

	return truncate(value.trim(), maxLength);
}

function getBearerToken(req: Request) {
	const header = req.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}

function getProfileLabel(profile: Pick<MemberProfile, 'display_name' | 'first_name' | 'email'>) {
	if (profile.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile.first_name?.trim()) {
		return profile.first_name.trim();
	}

	if (profile.email) {
		return profile.email.split('@')[0];
	}

	return 'Member';
}

function getFirstName(profile: Pick<MemberProfile, 'first_name' | 'display_name' | 'email'>) {
	if (profile.first_name?.trim()) {
		return profile.first_name.trim();
	}

	if (profile.display_name?.trim()) {
		return profile.display_name.trim().split(/\s+/)[0] ?? 'there';
	}

	if (profile.email) {
		return profile.email.split('@')[0];
	}

	return 'there';
}

function getStaffFirstName(staff: StaffProfile) {
	if (staff.first_name?.trim()) {
		return staff.first_name.trim();
	}

	if (staff.display_name?.trim()) {
		return staff.display_name.trim().split(/\s+/)[0] ?? 'there';
	}

	if (staff.email) {
		return staff.email.split('@')[0];
	}

	return 'there';
}

function getGuideLabel(
	guide?: { display_name?: string | null; name?: string | null; email?: string | null } | null
) {
	if (guide?.display_name?.trim()) {
		return guide.display_name.trim();
	}

	if (guide?.name?.trim()) {
		return guide.name.trim();
	}

	if (guide?.email) {
		return guide.email.split('@')[0];
	}

	return 'No preference';
}

async function sendTemplatedEmail(params: {
	to: string;
	subject: string;
	templateId: string;
	variables: Record<string, string>;
}): Promise<boolean> {
	const apiKey = getRequiredEnv('RESEND_API_KEY');
	const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: fromEmail,
			to: params.to,
			subject: params.subject,
			template: {
				id: params.templateId,
				variables: params.variables
			}
		})
	});

	if (!res.ok) {
		console.error(`[Email] Failed to send to ${params.to}:`, await res.text());
		return false;
	}

	return true;
}

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	try {
		const token = getBearerToken(req);
		if (!token) {
			return jsonResponse({ error: 'Missing authorization token' }, 401);
		}

		const adminClient = createClient(
			getRequiredEnv('SUPABASE_URL'),
			getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
		);

		const {
			data: { user },
			error: userError
		} = await adminClient.auth.getUser(token);

		if (userError || !user) {
			return jsonResponse({ error: 'Invalid authorization token' }, 401);
		}

		const payload: RequestSlotContactPayload = await req.json();
		const preferredWindows = optionalString(
			payload.preferredWindows,
			MAX_PREFERRED_WINDOWS_LENGTH
		);
		const note = optionalString(payload.note, MAX_NOTE_LENGTH);
		const guideId = optionalString(payload.guideId, 100);

		if (!preferredWindows) {
			return jsonResponse({ error: 'Preferred days/times are required' }, 400);
		}

		const templateStaff = getRequiredEnv('TEMPLATE_STAFF_TIME_REQUEST');
		const templateMember = getRequiredEnv('TEMPLATE_MEMBER_TIME_REQUEST_ACK');

		const { data: profile, error: profileError } = await adminClient
			.from('profiles')
			.select('id, email, first_name, display_name, city_state')
			.eq('id', user.id)
			.maybeSingle();

		if (profileError || !profile) {
			console.error('[request-slot-contact] Failed to fetch member profile:', profileError);
			return jsonResponse({ error: 'Could not load member profile' }, 500);
		}

		const memberProfile = profile as MemberProfile;
		const memberEmail = memberProfile.email ?? user.email ?? '';
		if (!memberEmail) {
			return jsonResponse({ error: 'Member email is required' }, 400);
		}

		const { data: guideProfile } = guideId
			? await adminClient
					.from('guide_profiles')
					.select('id, user_id, email, name, display_name')
					.eq('id', guideId)
					.maybeSingle()
			: { data: null };

		const guideLabel = getGuideLabel(guideProfile);
		const staffIds: string[] = [];

		if (guideProfile?.user_id) {
			staffIds.push(guideProfile.user_id);
		}

		const { data: adminMods, error: adminModsError } = await adminClient
			.from('profiles')
			.select('id')
			.in('role', ['admin', 'moderator'])
			.neq('suspended', true);

		if (adminModsError) {
			console.error('[request-slot-contact] Failed to fetch staff recipients:', adminModsError);
			return jsonResponse({ error: 'Could not load staff recipients' }, 500);
		}

		for (const staff of adminMods ?? []) {
			if (!staffIds.includes(staff.id)) {
				staffIds.push(staff.id);
			}
		}

		const { data: staffProfiles, error: staffProfilesError } =
			staffIds.length > 0
				? await adminClient
						.from('profiles')
						.select('id, email, first_name, display_name')
						.in('id', staffIds)
				: { data: [] as StaffProfile[], error: null };

		if (staffProfilesError) {
			console.error('[request-slot-contact] Failed to fetch staff profiles:', staffProfilesError);
			return jsonResponse({ error: 'Could not load staff profiles' }, 500);
		}

		const adminPanelUrl = getRequiredBaseUrl('ADMIN_APP_URL');
		const memberProfileUrl = `${adminPanelUrl}/members/${memberProfile.id}`;
		const memberName = getProfileLabel(memberProfile);
		const memberFirstName = getFirstName(memberProfile);
		const notificationDetail = `${memberName} requested a time: ${preferredWindows}`;

		const { error: notificationError } =
			staffIds.length > 0
				? await adminClient.from('staff_notifications').insert(
						staffIds.map((recipientId) => ({
							recipient_id: recipientId,
							kind: 'slot',
							tone: 'info',
							title: 'Time requested',
							detail: truncate(notificationDetail, 500),
							href: `/members/${memberProfile.id}`,
							read: false
						}))
					)
				: { error: null };

		if (notificationError) {
			console.error('[request-slot-contact] Failed to create staff notifications:', notificationError);
			return jsonResponse({ error: 'Could not create staff notifications' }, 500);
		}

		let staffEmailsSent = 0;
		for (const staff of (staffProfiles ?? []) as StaffProfile[]) {
			if (!staff.email) {
				continue;
			}

			const sent = await sendTemplatedEmail({
				to: staff.email,
				subject: `${memberName} requested an Alignment Conversation time`,
				templateId: templateStaff,
				variables: {
					firstName: getStaffFirstName(staff),
					memberName,
					memberEmail,
					preferredGuideName: guideLabel,
					preferredWindow: preferredWindows,
					note: note || 'None provided',
					memberProfileUrl
				}
			});

			if (sent) {
				staffEmailsSent += 1;
			}
		}

		const memberAckSent = await sendTemplatedEmail({
			to: memberEmail,
			subject: 'We received your time request',
			templateId: templateMember,
			variables: {
				firstName: memberFirstName
			}
		});

		return jsonResponse({
			sent: true,
			staffEmailsSent,
			memberAckSent,
			notificationsCreated: staffIds.length
		});
	} catch (err) {
		console.error('[request-slot-contact] Error:', err);
		const message = err instanceof Error ? err.message : 'Internal error';
		return jsonResponse({ error: message }, 500);
	}
});
