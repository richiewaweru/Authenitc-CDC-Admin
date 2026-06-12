import { error, fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { getSupabaseAdminClient } from '$lib/supabase-admin';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];
type OnboardingRow = Database['public']['Tables']['onboarding_responses']['Row'];
type PreferenceRow = Database['public']['Tables']['preferences']['Row'];

const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';
const RESERVED_RECORD_FIELDS = new Set(['id', 'user_id', 'created_at', 'updated_at']);

function uniqueValues(values: Array<string | null | undefined>) {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getProfileLabel(profile: Pick<ProfileRow, 'display_name' | 'email'>) {
	if (profile.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile.email) {
		return profile.email.split('@')[0];
	}

	return 'Unknown member';
}

function getGuideLabel(guide?: Pick<GuideRow, 'display_name' | 'name' | 'email'> | null) {
	if (guide?.display_name?.trim()) {
		return guide.display_name.trim();
	}

	if (guide?.name?.trim()) {
		return guide.name.trim();
	}

	if (guide?.email) {
		return guide.email.split('@')[0];
	}

	return 'Unknown guide';
}

function humanizeFieldLabel(key: string) {
	return key
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function formatFieldValue(value: unknown) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item)).join(', ');
	}

	if (typeof value === 'boolean') {
		return value ? 'Yes' : 'No';
	}

	if (value && typeof value === 'object') {
		return JSON.stringify(value);
	}

	return value == null ? '' : String(value);
}

function buildRecordFields(
	record: Record<string, unknown> | null,
	preferredOrder: string[]
): Array<{ key: string; label: string; value: string }> {
	if (!record) {
		return [];
	}

	const keys = Object.keys(record).filter((key) => !RESERVED_RECORD_FIELDS.has(key));
	const orderedKeys = [
		...preferredOrder.filter((key) => keys.includes(key)),
		...keys.filter((key) => !preferredOrder.includes(key)).sort((left, right) => left.localeCompare(right))
	];

	return orderedKeys
		.map((key) => ({
			key,
			label: humanizeFieldLabel(key),
			value: formatFieldValue(record[key])
		}))
		.filter((entry) => entry.value.trim().length > 0);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const resolvedRole = await resolveAppRole(locals);

	if (!isStaffRole(resolvedRole)) {
		throw redirect(303, '/access-denied');
	}

	const role = resolvedRole as StaffRole;
	const issues: string[] = [];
	let guideId: string | null = null;

	if (role === 'guide') {
		const { data, error: guideError } = await locals.supabase.rpc('get_my_guide_id');

		if (guideError) {
			issues.push(guideError.message);
		} else {
			guideId = data;
		}
	}

	const profileResult = await locals.supabase
		.from('profiles')
		.select(
			'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
		)
		.eq('id', params.id)
		.maybeSingle();

	if (profileResult.error) {
		throw error(500, profileResult.error.message);
	}

	const profile = profileResult.data as ProfileRow | null;

	if (!profile) {
		throw error(404, 'Member not found.');
	}

	const bookingsQuery = locals.supabase
		.from('bookings')
		.select(
			'id, user_id, guide_id, slot_id, slot_date, slot_time, duration_minutes, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
		)
		.eq('user_id', params.id)
		.order('created_at', { ascending: false });

	const scopedBookingsResult =
		role === 'guide'
			? await bookingsQuery.eq('guide_id', guideId ?? EMPTY_GUIDE_ID)
			: await bookingsQuery;

	if (scopedBookingsResult.error) {
		issues.push(scopedBookingsResult.error.message);
	}

	const bookings = (scopedBookingsResult.data ?? []) as BookingRow[];

	if (role === 'guide' && bookings.length === 0) {
		throw error(404, 'Member not found.');
	}

	const guideIds = uniqueValues(bookings.map((booking) => booking.guide_id));
	const [guidesResult, onboardingResult, preferencesResult] = await Promise.all([
		guideIds.length > 0
			? locals.supabase
					.from('guide_profiles')
					.select(
						'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
					)
					.in('id', guideIds)
			: Promise.resolve({ data: [] as GuideRow[], error: null }),
		locals.supabase
			.from('onboarding_responses')
			.select('*')
			.eq('user_id', params.id)
			.order('updated_at', { ascending: false })
			.limit(1),
		locals.supabase
			.from('preferences')
			.select('*')
			.eq('user_id', params.id)
			.order('updated_at', { ascending: false })
			.limit(1)
	]);

	if (guidesResult.error) {
		issues.push(guidesResult.error.message);
	}

	if (onboardingResult.error) {
		issues.push(onboardingResult.error.message);
	}

	if (preferencesResult.error) {
		issues.push(preferencesResult.error.message);
	}

	const guidesMap = new Map(((guidesResult.data ?? []) as GuideRow[]).map((guide) => [guide.id, guide]));
	const onboarding = (((onboardingResult.data ?? []) as OnboardingRow[])[0] ?? null) as
		| Record<string, unknown>
		| null;
	const preferences = (((preferencesResult.data ?? []) as PreferenceRow[])[0] ?? null) as
		| Record<string, unknown>
		| null;

	return {
		role,
		member: {
			id: profile.id,
			label: getProfileLabel(profile),
			email: profile.email ?? 'unknown@authentic.app',
			avatarUrl: profile.avatar_url,
			accountRole: profile.role,
			suspended: profile.suspended,
			userState: profile.user_state,
			onboardingComplete: Boolean(profile.onboarding_complete || onboarding),
			lastSignInAt: profile.last_sign_in_at,
			createdAt: profile.created_at,
			updatedAt: profile.updated_at
		},
		bookingHistory: bookings.map((booking) => {
			const guide = guidesMap.get(booking.guide_id);

			return {
				id: booking.id,
				guideLabel: getGuideLabel(guide),
				guideTitle: guide?.title ?? 'Community Guide',
				status: booking.status ?? 'confirmed',
				paymentStatus: booking.payment_status ?? 'pending',
				slotDate: booking.slot_date,
				slotTime: booking.slot_time,
				durationMinutes: booking.duration_minutes ?? 30,
				amountPaid: booking.amount_paid ?? 0,
				currency: booking.currency ?? 'usd',
				cancelReason: booking.cancel_reason,
				updatedAt: booking.updated_at,
				href: `/bookings?booking=${booking.id}`
			};
		}),
		bookingSummary: {
			total: bookings.length,
			confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
			completed: bookings.filter((booking) => booking.status === 'completed').length
		},
		onboardingFields: buildRecordFields(onboarding, [
			'relationship_goal',
			'spouse_qualities',
			'communication_style',
			'conflict_style',
			'lifestyle_vision',
			'shared_activities',
			'shared_faith',
			'church_involvement',
			'faith_role',
			'future_hopes',
			'authentic_meaning'
		]),
		preferenceFields: buildRecordFields(preferences, [
			'age_min',
			'age_max',
			'distance_min',
			'distance_max',
			'denominations',
			'dealbreaker_smoking',
			'dealbreaker_children',
			'dealbreaker_politics',
			'dealbreaker_church',
			'notify_new_alignments',
			'notify_event_updates',
			'notify_community_updates'
		]),
		canSuspend: (role === 'admin' || role === 'moderator') && profile.role === 'member',
		canPromote: role === 'admin' && profile.role === 'member',
		issues
	};
};

export const actions: Actions = {
	suspend: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);
		const adminSupabase = getSupabaseAdminClient();

		if (role !== 'admin' && role !== 'moderator') {
			return fail(403, { message: 'Only admins and moderators can update member access.' });
		}

		const formData = await request.formData();
		const memberId = formData.get('memberId')?.toString().trim() ?? '';
		const nextSuspended = formData.get('nextSuspended')?.toString() === 'true';

		if (!memberId) {
			return fail(400, { message: 'Member id is required.' });
		}

		const { data: member, error: memberError } = await adminSupabase
			.from('profiles')
			.select('id, role, suspended')
			.eq('id', memberId)
			.maybeSingle();

		if (memberError) {
			return fail(500, { message: memberError.message });
		}

		if (!member) {
			return fail(404, { message: 'Member not found.' });
		}

		if (member.role !== 'member') {
			return fail(400, { message: 'Only member accounts can be updated from this screen.' });
		}

		const { error: updateError } = await adminSupabase
			.from('profiles')
			.update({
				suspended: nextSuspended,
				updated_at: new Date().toISOString()
			})
			.eq('id', memberId);

		if (updateError) {
			return fail(500, { message: updateError.message });
		}

		return {
			success: true,
			message: nextSuspended
				? 'Member access has been suspended.'
				: 'Member access has been restored.'
		};
	},
	promote: async ({ locals, request }) => {
		const adminSupabase = getSupabaseAdminClient();

		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can promote members to moderators.' });
		}

		const formData = await request.formData();
		const memberId = formData.get('memberId')?.toString().trim() ?? '';

		if (!memberId) {
			return fail(400, { message: 'Member id is required.' });
		}

		const { data: member, error: memberError } = await adminSupabase
			.from('profiles')
			.select('id, role')
			.eq('id', memberId)
			.maybeSingle();

		if (memberError) {
			return fail(500, { message: memberError.message });
		}

		if (!member) {
			return fail(404, { message: 'Member not found.' });
		}

		if (member.role !== 'member') {
			return fail(400, { message: 'This account is no longer a member.' });
		}

		const { error: updateError } = await adminSupabase
			.from('profiles')
			.update({
				role: 'moderator',
				updated_at: new Date().toISOString()
			})
			.eq('id', memberId);

		if (updateError) {
			return fail(500, { message: updateError.message });
		}

		return {
			success: true,
			message:
				'Member promoted to moderator. They can now sign in as staff and will move into Team management.'
		};
	}
};
