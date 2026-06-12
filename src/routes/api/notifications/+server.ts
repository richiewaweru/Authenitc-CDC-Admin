import { json } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import type { AppNotification } from '$lib/stores/notifications';
import { getSupabaseAdminClient } from '$lib/supabase-admin';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { RequestHandler } from './$types';

type BookingRow = Pick<
	Database['public']['Tables']['bookings']['Row'],
	'id' | 'user_id' | 'guide_id' | 'created_at'
>;

type ProfileRow = Pick<
	Database['public']['Tables']['profiles']['Row'],
	'id' | 'email' | 'display_name' | 'onboarding_complete' | 'updated_at' | 'created_at'
>;

type GuideRow = Pick<
	Database['public']['Tables']['guide_profiles']['Row'],
	'id' | 'email' | 'display_name' | 'name'
>;

const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';

function getProfileLabel(profile?: { display_name?: string | null; email?: string | null } | null) {
	if (profile?.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile?.email) {
		return profile.email.split('@')[0];
	}

	return 'Unknown member';
}

function getGuideLabel(guide?: {
	display_name?: string | null;
	name?: string | null;
	email?: string | null;
} | null) {
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

export const GET: RequestHandler = async ({ locals, url }) => {
	const role = (await resolveAppRole(locals)) as StaffRole | null;

	if (!isStaffRole(role)) {
		return json({ notifications: [] }, { status: 403 });
	}

	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ notifications: [] }, { status: 401 });
	}

	const rawSince = url.searchParams.get('since');
	const since = rawSince && !Number.isNaN(Date.parse(rawSince)) ? rawSince : new Date().toISOString();
	const adminSupabase = getSupabaseAdminClient();

	let guideId: string | null = null;

	if (role === 'guide') {
		const { data: guideProfile } = await adminSupabase
			.from('guide_profiles')
			.select('id')
			.eq('user_id', user.id)
			.maybeSingle();

		guideId = guideProfile?.id ?? EMPTY_GUIDE_ID;
	}

	const bookingsQuery =
		role === 'guide'
			? adminSupabase
					.from('bookings')
					.select('id, user_id, guide_id, created_at')
					.eq('guide_id', guideId!)
					.gt('created_at', since)
					.order('created_at', { ascending: true })
					.limit(10)
			: adminSupabase
					.from('bookings')
					.select('id, user_id, guide_id, created_at')
					.gt('created_at', since)
					.order('created_at', { ascending: true })
					.limit(10);

	const profilesQuery =
		role === 'guide'
			? Promise.resolve({ data: [] as ProfileRow[], error: null })
			: adminSupabase
					.from('profiles')
					.select('id, email, display_name, onboarding_complete, updated_at, created_at')
					.eq('onboarding_complete', true)
					.gt('updated_at', since)
					.order('updated_at', { ascending: true })
					.limit(10);

	const [{ data: bookings, error: bookingsError }, { data: profiles, error: profilesError }] =
		await Promise.all([bookingsQuery, profilesQuery]);

	if (bookingsError || profilesError) {
		return json({ notifications: [] }, { status: 500 });
	}

	const bookingRows = (bookings ?? []) as BookingRow[];
	const profileRows = (profiles ?? []) as ProfileRow[];

	const memberIds = [...new Set(bookingRows.map((booking) => booking.user_id))];
	const guideIds = [...new Set(bookingRows.map((booking) => booking.guide_id))];

	const [{ data: memberProfiles }, { data: guideProfiles }] = await Promise.all([
		memberIds.length > 0
			? adminSupabase
					.from('profiles')
					.select('id, email, display_name')
					.in('id', memberIds)
			: Promise.resolve({ data: [] }),
		guideIds.length > 0
			? adminSupabase
					.from('guide_profiles')
					.select('id, email, display_name, name')
					.in('id', guideIds)
			: Promise.resolve({ data: [] })
	]);

	const memberMap = new Map(
		((memberProfiles ?? []) as Array<Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'email' | 'display_name'>>).map(
			(profile) => [profile.id, profile]
		)
	);
	const guideMap = new Map(
		((guideProfiles ?? []) as GuideRow[]).map((guide) => [guide.id, guide])
	);

	const notifications: AppNotification[] = [
		...bookingRows.map((booking) => ({
			id: `feed-booking:${booking.id}:${booking.created_at ?? 'unknown'}`,
			kind: 'booking' as const,
			tone: 'info' as const,
			title: 'New booking',
			detail: `${getProfileLabel(memberMap.get(booking.user_id))} booked with ${getGuideLabel(guideMap.get(booking.guide_id))}.`,
			href: `/bookings?booking=${booking.id}`,
			createdAt: booking.created_at ?? new Date().toISOString(),
			read: false
		})),
		...profileRows.map((profile) => ({
			id: `feed-profile:${profile.id}:${profile.updated_at ?? profile.created_at ?? 'unknown'}`,
			kind: 'onboarding' as const,
			tone: 'success' as const,
			title: 'Onboarding ready',
			detail: `${getProfileLabel(profile)} completed onboarding and is ready for review.`,
			href: `/members/${profile.id}`,
			createdAt: profile.updated_at ?? profile.created_at ?? new Date().toISOString(),
			read: false
		}))
	].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

	return json({ notifications });
};
