import { redirect } from '@sveltejs/kit';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { PageServerLoad } from './$types';

type DashboardCard = {
	label: string;
	value: string;
	href: string;
	note: string;
};

type ActivityItem = {
	id: string;
	type: 'booking' | 'onboarding';
	title: string;
	detail: string;
	href: string;
	timestamp: string | null;
};

type UpcomingItem = {
	id: string;
	startsAt: string | null;
	guideName: string;
	memberName: string;
	status: string;
	paymentStatus: string | null;
	href: string;
};

type AttentionItem = {
	id: string;
	type: 'payment' | 'review';
	title: string;
	detail: string;
	href: string;
	timestamp: string | null;
};

type QueryIssue = {
	source: string;
	message: string;
};

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SlotRow = Database['public']['Tables']['available_slots']['Row'];
type OnboardingRow = Database['public']['Tables']['onboarding_responses']['Row'];

const HOURS_48_MS = 48 * 60 * 60 * 1000;
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';

function startOfToday(date = new Date()) {
	const value = new Date(date);
	value.setHours(0, 0, 0, 0);
	return value;
}

function endOfToday(date = new Date()) {
	const value = new Date(date);
	value.setHours(23, 59, 59, 999);
	return value;
}

function humanizeError(error: PostgrestError | null, fallback: string) {
	return error?.message ?? fallback;
}

function getProfileLabel(profile?: Pick<ProfileRow, 'display_name' | 'email'> | null) {
	if (profile?.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile?.email) {
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

function uniqueValues(values: Array<string | null | undefined>) {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function fetchProfilesMap(
	supabase: SupabaseClient<Database>,
	ids: string[]
): Promise<{ map: Map<string, ProfileRow>; issue?: QueryIssue }> {
	if (ids.length === 0) {
		return { map: new Map() };
	}

	const { data, error } = await supabase
		.from('profiles')
		.select(
			'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
		)
		.in('id', ids);

	if (error) {
		return {
			map: new Map(),
			issue: {
				source: 'profiles lookup',
				message: humanizeError(error, 'Unable to load related member profiles.')
			}
		};
	}

	return { map: new Map((data ?? []).map((profile) => [profile.id, profile])) };
}

async function fetchGuidesMap(
	supabase: SupabaseClient<Database>,
	ids: string[]
): Promise<{ map: Map<string, GuideRow>; issue?: QueryIssue }> {
	if (ids.length === 0) {
		return { map: new Map() };
	}

	const { data, error } = await supabase
		.from('guide_profiles')
		.select(
			'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
		)
		.in('id', ids);

	if (error) {
		return {
			map: new Map(),
			issue: {
				source: 'guide_profiles lookup',
				message: humanizeError(error, 'Unable to load related guide profiles.')
			}
		};
	}

	return { map: new Map((data ?? []).map((guide) => [guide.id, guide])) };
}

function buildAdminCards(
	pendingBookings: number,
	todaysCalls: number,
	totalMembers: number,
	activeGuides: number
): DashboardCard[] {
	return [
		{
			label: 'Pending Bookings',
			value: `${pendingBookings}`,
			href: '/bookings',
			note: 'Confirmed sessions awaiting follow-through'
		},
		{
			label: "Today's Calls",
			value: `${todaysCalls}`,
			href: '/slots',
			note: "Booked conversations on today's schedule"
		},
		{
			label: 'Total Members',
			value: `${totalMembers}`,
			href: '/members',
			note: 'Community members in the active directory'
		},
		{
			label: 'Active Guides',
			value: `${activeGuides}`,
			href: '/guides',
			note: 'Guides currently marked active in the roster'
		}
	];
}

function buildGuideCards(
	confirmedBookings: number,
	todaysCalls: number,
	assignedMembers: number,
	openSlots: number
): DashboardCard[] {
	return [
		{
			label: 'Your Bookings',
			value: `${confirmedBookings}`,
			href: '/bookings',
			note: 'Confirmed conversations currently assigned to you'
		},
		{
			label: "Today's Calls",
			value: `${todaysCalls}`,
			href: '/slots',
			note: 'Your booked conversations happening today'
		},
		{
			label: 'Members You Support',
			value: `${assignedMembers}`,
			href: '/members',
			note: 'Unique members connected to your bookings'
		},
		{
			label: 'Open Slots',
			value: `${openSlots}`,
			href: '/slots',
			note: 'Available time slots still open on your calendar'
		}
	];
}

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;
	const resolvedRole = await resolveAppRole(locals);

	if (!isStaffRole(resolvedRole)) {
		throw redirect(303, '/access-denied');
	}

	const role = resolvedRole as StaffRole;
	const issues: QueryIssue[] = [];
	const now = new Date();
	const todayStartIso = startOfToday(now).toISOString();
	const todayEndIso = endOfToday(now).toISOString();
	const next48Iso = new Date(now.getTime() + HOURS_48_MS).toISOString();
	const overdueIso = new Date(now.getTime() - HOURS_24_MS).toISOString();

	let guideId: string | null = null;

	if (role === 'guide') {
		const { data, error } = await supabase.rpc('get_my_guide_id');

		if (error) {
			issues.push({
				source: 'get_my_guide_id',
				message: humanizeError(error, 'Unable to resolve the current guide profile.')
			});
		} else {
			guideId = data;
		}
	}

	const scopedGuideId = role === 'guide' ? guideId ?? EMPTY_GUIDE_ID : null;

	if (role === 'guide' && !guideId) {
		issues.push({
			source: 'guide scope',
			message:
				'Your guide account is not linked to a guide profile yet, so the dashboard is showing empty guide-scoped results.'
		});
	}

	const pendingBookingsQuery =
		role === 'guide'
			? supabase
					.from('bookings')
					.select('id', { count: 'exact', head: true })
					.eq('guide_id', scopedGuideId!)
					.eq('status', 'confirmed')
			: supabase
					.from('bookings')
					.select('id', { count: 'exact', head: true })
					.eq('status', 'confirmed');

	const todaysCallsQuery =
		role === 'guide'
			? supabase
					.from('available_slots')
					.select('id', { count: 'exact', head: true })
					.eq('guide_id', scopedGuideId!)
					.eq('status', 'booked')
					.gte('starts_at', todayStartIso)
					.lte('starts_at', todayEndIso)
			: supabase
					.from('available_slots')
					.select('id', { count: 'exact', head: true })
					.eq('status', 'booked')
					.gte('starts_at', todayStartIso)
					.lte('starts_at', todayEndIso);

	const totalMembersQuery =
		role === 'guide'
			? supabase.from('bookings').select('user_id').eq('guide_id', scopedGuideId!)
			: supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member');

	const activeGuidesQuery =
		role === 'guide'
			? supabase
					.from('available_slots')
					.select('id', { count: 'exact', head: true })
					.eq('guide_id', scopedGuideId!)
					.eq('status', 'open')
			: supabase
					.from('guide_profiles')
					.select('id', { count: 'exact', head: true })
					.eq('is_active', true);

	const recentBookingsQuery =
		role === 'guide'
			? supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.eq('guide_id', scopedGuideId!)
					.order('created_at', { ascending: false })
					.limit(10)
			: supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.order('created_at', { ascending: false })
					.limit(10);

	const recentOnboardingQuery = supabase
		.from('onboarding_responses')
		.select('id, user_id, created_at, updated_at')
		.order('updated_at', { ascending: false })
		.limit(10);

	const upcomingSlotsQuery =
		role === 'guide'
			? supabase
					.from('available_slots')
					.select(
						'id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by'
					)
					.eq('guide_id', scopedGuideId!)
					.eq('status', 'booked')
					.gte('starts_at', now.toISOString())
					.lte('starts_at', next48Iso)
					.order('starts_at', { ascending: true })
					.limit(10)
			: supabase
					.from('available_slots')
					.select(
						'id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by'
					)
					.eq('status', 'booked')
					.gte('starts_at', now.toISOString())
					.lte('starts_at', next48Iso)
					.order('starts_at', { ascending: true })
					.limit(10);

	const overdueBookingsQuery =
		role === 'guide'
			? supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.eq('guide_id', scopedGuideId!)
					.eq('payment_status', 'pending')
					.lt('created_at', overdueIso)
					.order('created_at', { ascending: true })
					.limit(5)
			: supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.eq('payment_status', 'pending')
					.lt('created_at', overdueIso)
					.order('created_at', { ascending: true })
					.limit(5);

	const pendingReviewsQuery = supabase
		.from('profiles')
		.select(
			'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
		)
		.eq('onboarding_complete', true)
		.eq('user_state', 'onboarding_complete')
		.order('updated_at', { ascending: false })
		.limit(5);

	const [
		pendingBookingsResult,
		todaysCallsResult,
		totalMembersResult,
		activeGuidesResult,
		recentBookingsResult,
		recentOnboardingResult,
		upcomingSlotsResult,
		overdueBookingsResult,
		pendingReviewsResult
	] = await Promise.all([
		pendingBookingsQuery,
		todaysCallsQuery,
		totalMembersQuery,
		activeGuidesQuery,
		recentBookingsQuery,
		recentOnboardingQuery,
		upcomingSlotsQuery,
		overdueBookingsQuery,
		pendingReviewsQuery
	]);

	if (pendingBookingsResult.error) {
		issues.push({
			source: 'pending bookings stat',
			message: humanizeError(pendingBookingsResult.error, 'Unable to load pending booking count.')
		});
	}

	if (todaysCallsResult.error) {
		issues.push({
			source: "today's calls stat",
			message: humanizeError(todaysCallsResult.error, "Unable to load today's calls count.")
		});
	}

	if (totalMembersResult.error) {
		issues.push({
			source: 'member stat',
			message: humanizeError(totalMembersResult.error, 'Unable to load member count.')
		});
	}

	if (activeGuidesResult.error) {
		issues.push({
			source: 'guide stat',
			message: humanizeError(activeGuidesResult.error, 'Unable to load guide stat.')
		});
	}

	if (recentBookingsResult.error) {
		issues.push({
			source: 'recent bookings',
			message: humanizeError(recentBookingsResult.error, 'Unable to load recent bookings.')
		});
	}

	if (recentOnboardingResult.error) {
		issues.push({
			source: 'recent onboarding',
			message: humanizeError(recentOnboardingResult.error, 'Unable to load onboarding completions.')
		});
	}

	if (upcomingSlotsResult.error) {
		issues.push({
			source: 'upcoming slots',
			message: humanizeError(upcomingSlotsResult.error, 'Unable to load upcoming booked slots.')
		});
	}

	if (overdueBookingsResult.error) {
		issues.push({
			source: 'overdue payments',
			message: humanizeError(overdueBookingsResult.error, 'Unable to load overdue payment bookings.')
		});
	}

	if (pendingReviewsResult.error) {
		issues.push({
			source: 'pending reviews',
			message: humanizeError(pendingReviewsResult.error, 'Unable to load pending review profiles.')
		});
	}

	const recentBookings = (recentBookingsResult.data ?? []) as BookingRow[];
	const recentOnboarding = (recentOnboardingResult.data ?? []) as OnboardingRow[];
	const upcomingSlots = (upcomingSlotsResult.data ?? []) as SlotRow[];
	const overdueBookings = (overdueBookingsResult.data ?? []) as BookingRow[];
	const pendingReviewProfiles = (pendingReviewsResult.data ?? []) as ProfileRow[];

	const allMemberIds = uniqueValues([
		...recentBookings.map((booking) => booking.user_id),
		...recentOnboarding.map((entry) => entry.user_id),
		...upcomingSlots.map((slot) => slot.booked_by),
		...overdueBookings.map((booking) => booking.user_id),
		...pendingReviewProfiles.map((profile) => profile.id)
	]);
	const allGuideIds = uniqueValues([
		...recentBookings.map((booking) => booking.guide_id),
		...upcomingSlots.map((slot) => slot.guide_id),
		...overdueBookings.map((booking) => booking.guide_id)
	]);

	const [{ map: profilesMap, issue: profilesIssue }, { map: guidesMap, issue: guidesIssue }] =
		await Promise.all([fetchProfilesMap(supabase, allMemberIds), fetchGuidesMap(supabase, allGuideIds)]);

	if (profilesIssue) {
		issues.push(profilesIssue);
	}

	if (guidesIssue) {
		issues.push(guidesIssue);
	}

	const cards =
		role === 'guide'
			? buildGuideCards(
					pendingBookingsResult.count ?? 0,
					todaysCallsResult.count ?? 0,
					new Set(
						((totalMembersResult.data as Array<{ user_id: string }> | null) ?? [])
							.map((row) => row.user_id)
							.filter(Boolean)
					).size,
					activeGuidesResult.count ?? 0
				)
			: buildAdminCards(
					pendingBookingsResult.count ?? 0,
					todaysCallsResult.count ?? 0,
					totalMembersResult.count ?? 0,
					activeGuidesResult.count ?? 0
				);

	const activityItems: ActivityItem[] = [
		...recentBookings.map((booking) => {
			const member = profilesMap.get(booking.user_id);
			const guide = guidesMap.get(booking.guide_id);

			return {
				id: `booking-${booking.id}`,
				type: 'booking' as const,
				title: `${getProfileLabel(member)} booked with ${getGuideLabel(guide)}`,
				detail: `Status: ${booking.status ?? 'confirmed'} | Payment ${booking.payment_status ?? 'pending'}`,
				href: '/bookings',
				timestamp: booking.created_at
			};
		}),
		...recentOnboarding.map((entry) => {
			const member = profilesMap.get(entry.user_id);

			return {
				id: `onboarding-${entry.id}`,
				type: 'onboarding' as const,
				title: `${getProfileLabel(member)} completed onboarding`,
				detail: 'Alignment profile and preferences were submitted for review.',
				href: member ? `/members/${member.id}` : '/members',
				timestamp: entry.updated_at
			};
		})
	]
		.sort((left, right) => {
			const leftValue = left.timestamp ? new Date(left.timestamp).getTime() : 0;
			const rightValue = right.timestamp ? new Date(right.timestamp).getTime() : 0;
			return rightValue - leftValue;
		})
		.slice(0, 10);

	const upcomingItems: UpcomingItem[] = upcomingSlots.map((slot) => {
		const member = slot.booked_by ? profilesMap.get(slot.booked_by) : null;
		const guide = guidesMap.get(slot.guide_id);
		const matchingBooking = recentBookings
			.concat(overdueBookings)
			.find((booking) => booking.slot_id === slot.id);

		return {
			id: slot.id,
			startsAt: slot.starts_at,
			guideName: getGuideLabel(guide),
			memberName: getProfileLabel(member),
			status: slot.status ?? 'booked',
			paymentStatus: matchingBooking?.payment_status ?? null,
			href: '/slots'
		};
	});

	const attentionItems: AttentionItem[] = [
		...overdueBookings.map((booking) => {
			const member = profilesMap.get(booking.user_id);
			const guide = guidesMap.get(booking.guide_id);

			return {
				id: `payment-${booking.id}`,
				type: 'payment' as const,
				title: `Pending payment for ${getProfileLabel(member)}`,
				detail: `${getGuideLabel(guide)} | Amount paid: ${booking.amount_paid ?? 0} ${booking.currency ?? 'usd'}`,
				href: '/bookings',
				timestamp: booking.created_at
			};
		}),
		...pendingReviewProfiles.map((profile) => ({
			id: `review-${profile.id}`,
			type: 'review' as const,
			title: `${getProfileLabel(profile)} is pending review`,
			detail: 'Their onboarding is complete and waiting for staff follow-up.',
			href: `/members/${profile.id}`,
			timestamp: profile.updated_at ?? profile.created_at
		}))
	]
		.sort((left, right) => {
			const leftValue = left.timestamp ? new Date(left.timestamp).getTime() : 0;
			const rightValue = right.timestamp ? new Date(right.timestamp).getTime() : 0;
			return rightValue - leftValue;
		})
		.slice(0, 10);

	return {
		cards,
		activityItems,
		upcomingItems,
		attentionItems,
		issues,
		role,
		realtimeTarget: 'bookings'
	};
};
