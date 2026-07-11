import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

function formatDate(slotDate: string | null | undefined): string {
	if (!slotDate) {
		return 'your scheduled date';
	}

	const [year, month, day] = slotDate.split('-').map(Number);
	return new Date(year, month - 1, day).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
}

function formatTime(slotTime: string | null | undefined): string {
	if (!slotTime) {
		return 'your scheduled time';
	}

	const [hour, minute] = slotTime.slice(0, 5).split(':').map(Number);
	const period = hour >= 12 ? 'PM' : 'AM';
	const normalizedHour = hour % 12 || 12;
	return `${normalizedHour}:${String(minute).padStart(2, '0')} ${period}`;
}

interface ExpoMessage {
	to: string;
	title: string;
	body: string;
	data?: Record<string, unknown>;
	sound?: 'default';
	priority?: 'high';
}

async function sendExpoPush(messages: ExpoMessage[]): Promise<boolean> {
	if (messages.length === 0) {
		return true;
	}

	const res = await fetch(EXPO_PUSH_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(messages)
	});

	if (!res.ok) {
		console.error('[Push] Expo error:', await res.text());
		return false;
	}

	return true;
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
		return new Response('OK', { status: 200 });
	}

	try {
		const supabase = createClient(
			getRequiredEnv('SUPABASE_URL'),
			getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
		);

		const template24h = getRequiredEnv('TEMPLATE_MEMBER_REMINDER_24H');
		const template1h = getRequiredEnv('TEMPLATE_MEMBER_REMINDER_1H');

		const now = new Date();
		const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
		const in1h = new Date(now.getTime() + 60 * 60 * 1000);
		const in75m = new Date(now.getTime() + 75 * 60 * 1000);

		const bookingSelect = `
      id, user_id, meeting_link,
      available_slots!slot_id!inner ( starts_at, slot_date, slot_time ),
      profiles!user_id        ( email, first_name, display_name, expo_push_token ),
      guide_profiles!guide_id ( display_name, name )
    `;

		const { data: rows24h, error: rows24hError } = await supabase
			.from('bookings')
			.select(bookingSelect)
			.eq('status', 'confirmed')
			.eq('reminder_24h_sent', false)
			.gte('available_slots.starts_at', in24h.toISOString())
			.lte('available_slots.starts_at', in25h.toISOString());

		if (rows24hError) {
			throw rows24hError;
		}

		const { data: rows1h, error: rows1hError } = await supabase
			.from('bookings')
			.select(bookingSelect)
			.eq('status', 'confirmed')
			.eq('reminder_1h_sent', false)
			.gte('available_slots.starts_at', in1h.toISOString())
			.lte('available_slots.starts_at', in75m.toISOString());

		if (rows1hError) {
			throw rows1hError;
		}

		const ids24h: string[] = [];

		for (const booking of rows24h ?? []) {
			const profile = (booking as any).profiles;
			const guide = (booking as any).guide_profiles;
			const slot = (booking as any).available_slots;
			if (!slot?.starts_at) continue;

			const guideName = guide?.display_name ?? guide?.name ?? 'your guide';
			const firstName = profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? 'there';
			const slotDate = formatDate(slot?.slot_date);
			const slotTime = formatTime(slot?.slot_time);
			const token = profile?.expo_push_token;
			let pushSent = false;
			let emailSent = false;

			if (token?.startsWith('ExponentPushToken[')) {
				pushSent = await sendExpoPush([
					{
						to: token,
						title: 'Your Alignment Conversation is Tomorrow',
						body: `Your conversation with ${guideName} is tomorrow. Open the app to check details.`,
						sound: 'default',
						priority: 'high',
						data: { bookingId: booking.id, type: 'reminder_24h' }
					}
				]);
			}

			if (profile?.email) {
				emailSent = await sendTemplatedEmail({
					to: profile.email,
					subject: `Reminder: Your Alignment Conversation is tomorrow at ${slotTime}`,
					templateId: template24h,
					variables: { firstName, guideName, slotDate, slotTime, meetingLink: booking.meeting_link ?? '' }
				});
			}

			if (pushSent || emailSent) {
				ids24h.push(booking.id);
			}
		}

		const ids1h: string[] = [];

		for (const booking of rows1h ?? []) {
			const profile = (booking as any).profiles;
			const guide = (booking as any).guide_profiles;
			const slot = (booking as any).available_slots;
			if (!slot?.starts_at) continue;

			const guideName = guide?.display_name ?? guide?.name ?? 'your guide';
			const firstName = profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? 'there';
			const slotTime = formatTime(slot?.slot_time);
			const token = profile?.expo_push_token;
			let pushSent = false;
			let emailSent = false;

			if (token?.startsWith('ExponentPushToken[')) {
				pushSent = await sendExpoPush([
					{
						to: token,
						title: 'Your Alignment Conversation Starts in 1 Hour',
						body: `Your conversation with ${guideName} starts soon. Open the app to join.`,
						sound: 'default',
						priority: 'high',
						data: { bookingId: booking.id, type: 'reminder_1h' }
					}
				]);
			}

			if (profile?.email) {
				emailSent = await sendTemplatedEmail({
					to: profile.email,
					subject: `Your Alignment Conversation starts in 1 hour — ${slotTime}`,
					templateId: template1h,
					variables: { firstName, guideName, slotTime, meetingLink: booking.meeting_link ?? '' }
				});
			}

			if (pushSent || emailSent) {
				ids1h.push(booking.id);
			}
		}

		if (ids24h.length > 0) {
			await supabase.from('bookings').update({ reminder_24h_sent: true }).in('id', ids24h);
		}

		if (ids1h.length > 0) {
			await supabase.from('bookings').update({ reminder_1h_sent: true }).in('id', ids1h);
		}

		console.log(
			`[Reminder] 24h: ${ids24h.length} sent | 1h: ${ids1h.length} sent`
		);

		return jsonResponse({ sent_24h: ids24h.length, sent_1h: ids1h.length });
	} catch (err) {
		console.error('[send-meeting-reminder] Error:', err);
		const message = err instanceof Error ? err.message : 'Internal error';
		return jsonResponse({ error: message }, 500);
	}
});
