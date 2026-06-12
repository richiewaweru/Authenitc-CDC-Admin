import { redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type Database, type StaffRole, type UserState } from '$lib/types';
import type { PageServerLoad } from './$types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];
type OnboardingRow = Database['public']['Tables']['onboarding_responses']['Row'];
type PreferenceRow = Database['public']['Tables']['preferences']['Row'];

type MemberStateFilter = 'all' | 'review' | 'onboarded' | 'active' | 'suspended';
type MemberListItem = {
	id: string;
	label: string;
	email: string;
	avatarUrl: string | null;
	suspended: boolean;
	userState: UserState | null;
	lastSignInAt: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	onboardingReady: boolean;
	preferencesReady: boolean;
	needsReview: boolean;
	totalBookings: number;
	confirmedBookings: number;
	completedBookings: number;
	latestBookingDate: string | null;
	latestBookingTime: string | null;
	guideLabels: string[];
};

const PAGE_SIZE = 12;
const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';
const ACTIVE_MEMBER_STATES = new Set<UserState>([
	'conversation_approved',
	'membership_active',
	'bylaws_accepted',
	'full_member'
]);
const STATE_OPTIONS = new Set<MemberStateFilter>([
	'all',
	'review',
	'onboarded',
	'active',
	'suspended'
]);

function normalizeState(value: string | null) {
	return value && STATE_OPTIONS.has(value as MemberStateFilter)
		? (value as MemberStateFilter)
		: 'all';
}

function normalizeSearch(value: string | null) {
	return value?.trim().toLowerCase() ?? '';
}

function normalizePage(value: string | null) {
	const parsed = Number.parseInt(value ?? '1', 10);
	return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

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

function matchesState(member: MemberListItem, state: MemberStateFilter) {
	if (state === 'review') {
		return member.needsReview;
	}

	if (state === 'onboarded') {
		return member.onboardingReady;
	}

	if (state === 'active') {
		return !member.suspended && Boolean(member.userState && ACTIVE_MEMBER_STATES.has(member.userState));
	}

	if (state === 'suspended') {
		return member.suspended;
	}

	return true;
}

function matchesSearch(member: MemberListItem, search: string) {
	if (!search) {
		return true;
	}

	const haystack = [
		member.label,
		member.email,
		member.userState ?? '',
		member.guideLabels.join(' ')
	]
		.join(' ')
		.toLowerCase();

	return haystack.includes(search);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const resolvedRole = await resolveAppRole(locals);

	if (!isStaffRole(resolvedRole)) {
		throw redirect(303, '/access-denied');
	}

	const role = resolvedRole as StaffRole;
	const state = normalizeState(url.searchParams.get('state'));
	const search = normalizeSearch(url.searchParams.get('search'));
	const requestedPage = normalizePage(url.searchParams.get('page'));
	const issues: string[] = [];

	let guideId: string | null = null;
	let guideScopedBookings: BookingRow[] = [];
	let memberProfiles: ProfileRow[] = [];

	if (role === 'guide') {
		const { data, error } = await locals.supabase.rpc('get_my_guide_id');

		if (error) {
			issues.push(error.message);
		} else {
			guideId = data;
		}

		if (!guideId) {
			issues.push(
				'Your guide account is not linked to a guide profile yet, so member results are scoped to an empty view.'
			);
		}

		const scopedBookingsResult = guideId
			? await locals.supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, slot_date, slot_time, duration_minutes, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.eq('guide_id', guideId ?? EMPTY_GUIDE_ID)
					.order('created_at', { ascending: false })
			: { data: [] as BookingRow[], error: null };

		if (scopedBookingsResult.error) {
			issues.push(scopedBookingsResult.error.message);
		}

		guideScopedBookings = (scopedBookingsResult.data ?? []) as BookingRow[];
		const scopedMemberIds = uniqueValues(guideScopedBookings.map((booking) => booking.user_id));

		const scopedProfilesResult =
			scopedMemberIds.length > 0
				? await locals.supabase
						.from('profiles')
						.select(
							'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
						)
						.eq('role', 'member')
						.in('id', scopedMemberIds)
						.order('updated_at', { ascending: false, nullsFirst: false })
				: { data: [] as ProfileRow[], error: null };

		if (scopedProfilesResult.error) {
			issues.push(scopedProfilesResult.error.message);
		}

		memberProfiles = (scopedProfilesResult.data ?? []) as ProfileRow[];
	} else {
		const profilesResult = await locals.supabase
			.from('profiles')
			.select(
				'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
			)
			.eq('role', 'member')
			.order('updated_at', { ascending: false, nullsFirst: false });

		if (profilesResult.error) {
			issues.push(profilesResult.error.message);
		}

		memberProfiles = (profilesResult.data ?? []) as ProfileRow[];
	}

	const memberIds = memberProfiles.map((profile) => profile.id);

	const bookingsResult =
		role === 'guide'
			? { data: guideScopedBookings, error: null }
			: memberIds.length > 0
				? await locals.supabase
						.from('bookings')
						.select(
							'id, user_id, guide_id, slot_id, slot_date, slot_time, duration_minutes, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
						)
						.in('user_id', memberIds)
						.order('created_at', { ascending: false })
				: { data: [] as BookingRow[], error: null };

	if (bookingsResult.error) {
		issues.push(bookingsResult.error.message);
	}

	const bookings = (bookingsResult.data ?? []) as BookingRow[];
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
		memberIds.length > 0
			? locals.supabase.from('onboarding_responses').select('*').in('user_id', memberIds)
			: Promise.resolve({ data: [] as OnboardingRow[], error: null }),
		memberIds.length > 0
			? locals.supabase.from('preferences').select('*').in('user_id', memberIds)
			: Promise.resolve({ data: [] as PreferenceRow[], error: null })
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
	const onboardingMap = new Map(
		((onboardingResult.data ?? []) as OnboardingRow[]).map((entry) => [entry.user_id, entry])
	);
	const preferencesMap = new Map(
		((preferencesResult.data ?? []) as PreferenceRow[]).map((entry) => [entry.user_id, entry])
	);
	const bookingsByUser = new Map<string, BookingRow[]>();

	for (const booking of bookings) {
		const current = bookingsByUser.get(booking.user_id) ?? [];
		current.push(booking);
		bookingsByUser.set(booking.user_id, current);
	}

	const allMembers = memberProfiles.map((profile) => {
		const memberBookings = bookingsByUser.get(profile.id) ?? [];
		const latestBooking = memberBookings[0] ?? null;
		const onboarding = onboardingMap.get(profile.id) ?? null;
		const preferences = preferencesMap.get(profile.id) ?? null;
		const guideLabels = [
			...new Set(memberBookings.map((booking) => getGuideLabel(guidesMap.get(booking.guide_id))))
		];
		const onboardingReady = Boolean(profile.onboarding_complete || onboarding);
		const needsReview = onboardingReady && profile.user_state === 'onboarding_complete';

		return {
			id: profile.id,
			label: getProfileLabel(profile),
			email: profile.email ?? 'unknown@authentic.app',
			avatarUrl: profile.avatar_url,
			suspended: profile.suspended,
			userState: profile.user_state,
			lastSignInAt: profile.last_sign_in_at,
			createdAt: profile.created_at,
			updatedAt: profile.updated_at,
			onboardingReady,
			preferencesReady: Boolean(preferences),
			needsReview,
			totalBookings: memberBookings.length,
			confirmedBookings: memberBookings.filter((booking) => booking.status === 'confirmed').length,
			completedBookings: memberBookings.filter((booking) => booking.status === 'completed').length,
			latestBookingDate: latestBooking?.slot_date ?? null,
			latestBookingTime: latestBooking?.slot_time ?? null,
			guideLabels
		} satisfies MemberListItem;
	});

	const filteredMembers = allMembers.filter(
		(member) => matchesState(member, state) && matchesSearch(member, search)
	);
	const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
	const currentPage = Math.min(requestedPage, totalPages);
	const from = (currentPage - 1) * PAGE_SIZE;
	const paginatedMembers = filteredMembers.slice(from, from + PAGE_SIZE);

	return {
		role,
		members: paginatedMembers,
		filters: {
			state,
			search
		},
		pagination: {
			page: currentPage,
			pageSize: PAGE_SIZE,
			totalCount: filteredMembers.length,
			totalPages
		},
		summary: {
			totalVisible: allMembers.length,
			onboardingReady: allMembers.filter((member) => member.onboardingReady).length,
			needsReview: allMembers.filter((member) => member.needsReview).length,
			suspended: allMembers.filter((member) => member.suspended).length
		},
		issues
	};
};
