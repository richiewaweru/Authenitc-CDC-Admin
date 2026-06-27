import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface BookingConfirmationPayload {
	bookingId: string;
	userEmail: string;
	userFirstName: string;
	guideName: string;
	guideTitle: string;
	slotDate: string;
	slotTime: string;
	durationMinutes: number;
	calendarUrl: string;
}

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

async function sendTemplatedEmail(params: {
	to: string;
	subject: string;
	templateId: string;
	variables: Record<string, string>;
}): Promise<void> {
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
	}
}

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	try {
		const payload: BookingConfirmationPayload = await req.json();
		const templateMember = getRequiredEnv('TEMPLATE_MEMBER_BOOKING');
		const templateStaff = getRequiredEnv('TEMPLATE_STAFF_BOOKING');

		const adminClient = createClient(
			getRequiredEnv('SUPABASE_URL'),
			getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
		);

		await sendTemplatedEmail({
			to: payload.userEmail,
			subject: `Your Alignment Conversation is confirmed — ${payload.slotDate}`,
			templateId: templateMember,
			variables: {
				firstName: payload.userFirstName,
				guideName: payload.guideName,
				guideTitle: payload.guideTitle,
				slotDate: payload.slotDate,
				slotTime: payload.slotTime,
				durationMinutes: String(payload.durationMinutes),
				calendarUrl: payload.calendarUrl
			}
		});

		const { data: booking } = await adminClient
			.from('bookings')
			.select('guide_id')
			.eq('id', payload.bookingId)
			.maybeSingle();

		const staffIds: string[] = [];

		if (booking?.guide_id) {
			const { data: guideProfile } = await adminClient
				.from('guide_profiles')
				.select('user_id')
				.eq('id', booking.guide_id)
				.maybeSingle();

			if (guideProfile?.user_id) {
				staffIds.push(guideProfile.user_id);
			}
		}

		const { data: adminMods } = await adminClient
			.from('profiles')
			.select('id')
			.in('role', ['admin', 'moderator'])
			.neq('suspended', true);

		for (const staff of adminMods ?? []) {
			if (!staffIds.includes(staff.id)) {
				staffIds.push(staff.id);
			}
		}

		const { data: staffProfiles } =
			staffIds.length > 0
				? await adminClient.from('profiles').select('id, email, first_name, display_name').in('id', staffIds)
				: { data: [] as Array<{ id: string; email: string | null; first_name?: string | null; display_name: string | null }> };

		const adminPanelUrl = Deno.env.get('ADMIN_APP_URL') ?? 'https://authenitc-cdc-admin.vercel.app';
		const bookingUrl = `${adminPanelUrl.replace(/\/+$/, '')}/bookings?booking=${payload.bookingId}`;

		for (const staff of staffProfiles ?? []) {
			if (!staff.email) {
				continue;
			}

			const staffFirstName =
				staff.first_name ?? staff.display_name?.split(' ')[0] ?? staff.email.split('@')[0];

			await sendTemplatedEmail({
				to: staff.email,
				subject: `New booking — ${payload.userFirstName} with ${payload.guideName} on ${payload.slotDate}`,
				templateId: templateStaff,
				variables: {
					firstName: staffFirstName,
					memberName: payload.userFirstName,
					memberEmail: payload.userEmail,
					guideName: payload.guideName,
					slotDate: payload.slotDate,
					slotTime: payload.slotTime,
					durationMinutes: String(payload.durationMinutes),
					bookingUrl
				}
			});
		}

		return jsonResponse({ sent: true });
	} catch (err) {
		console.error('[send-booking-confirmation] Error:', err);
		const message = err instanceof Error ? err.message : 'Internal error';
		return jsonResponse({ error: message }, 500);
	}
});
