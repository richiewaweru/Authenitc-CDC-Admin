import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface MemberEmailPayload {
	type: 'welcome' | 'onboarding_complete' | 'meeting_link_ready' | 'booking_cancelled';
	userEmail: string;
	firstName: string;
	guideName?: string;
	slotDate?: string;
	slotTime?: string;
	meetingLink?: string;
	memberCity?: string;
	memberEmail?: string;
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
			template_id: params.templateId,
			variables: params.variables
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
		const payload: MemberEmailPayload = await req.json();

		let templateId: string;
		let subject: string;
		let variables: Record<string, string> = { firstName: payload.firstName };

		switch (payload.type) {
			case 'welcome':
				templateId = getRequiredEnv('TEMPLATE_MEMBER_WELCOME');
				subject = 'Welcome to Authentic CDC';
				break;

			case 'onboarding_complete':
				templateId = getRequiredEnv('TEMPLATE_MEMBER_ONBOARDING');
				subject = 'Your Alignment Profile is received';
				break;

			case 'meeting_link_ready':
				templateId = getRequiredEnv('TEMPLATE_MEMBER_MEETING_LINK');
				subject = `Your meeting link is ready — ${payload.slotDate ?? 'upcoming'}`;
				variables = {
					...variables,
					guideName: payload.guideName ?? 'your guide',
					slotDate: payload.slotDate ?? 'your scheduled date',
					slotTime: payload.slotTime ?? 'your scheduled time',
					meetingLink: payload.meetingLink ?? ''
				};
				break;

			case 'booking_cancelled':
				templateId = Deno.env.get('TEMPLATE_MEMBER_CANCELLED') ?? '';
				subject = 'Your booking has been cancelled';
				variables = {
					...variables,
					guideName: payload.guideName ?? 'your guide',
					slotDate: payload.slotDate ?? 'your scheduled date',
					slotTime: payload.slotTime ?? 'your scheduled time'
				};

				if (!templateId) {
					console.log('[Email] No TEMPLATE_MEMBER_CANCELLED set — skipping cancellation email');
					return jsonResponse({ sent: false, reason: 'no template configured' });
				}
				break;

			default:
				return jsonResponse({ error: `Unknown email type: ${payload.type}` }, 400);
		}

		await sendTemplatedEmail({
			to: payload.userEmail,
			subject,
			templateId,
			variables
		});

		if (payload.type === 'onboarding_complete') {
			const staffTemplateId = Deno.env.get('TEMPLATE_STAFF_ONBOARDING') ?? '';

			if (staffTemplateId) {
				const adminClient = createClient(
					getRequiredEnv('SUPABASE_URL'),
					getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
				);

				const { data: staffProfiles } = await adminClient
					.from('profiles')
					.select('id, email, first_name, display_name')
					.in('role', ['admin', 'moderator'])
					.neq('suspended', true);

				const adminPanelUrl =
					Deno.env.get('ADMIN_APP_URL') ?? 'https://authenitc-cdc-admin.vercel.app';

				for (const staff of staffProfiles ?? []) {
					if (!staff.email) {
						continue;
					}

					const staffFirstName =
						staff.first_name ??
						staff.display_name?.split(' ')[0] ??
						staff.email.split('@')[0];

					await sendTemplatedEmail({
						to: staff.email,
						subject: `${payload.firstName} completed their Alignment Profile`,
						templateId: staffTemplateId,
						variables: {
							firstName: staffFirstName,
							memberName: payload.firstName,
							memberEmail: payload.memberEmail ?? payload.userEmail,
							memberCity: payload.memberCity ?? 'Not specified',
							memberProfileUrl: `${adminPanelUrl}/members`
						}
					});
				}
			}
		}

		return jsonResponse({ sent: true, type: payload.type });
	} catch (err) {
		console.error('[send-member-email] Error:', err);
		return jsonResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
	}
});
