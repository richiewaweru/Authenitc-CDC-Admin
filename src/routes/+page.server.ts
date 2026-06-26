import { redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { PageServerLoad } from './$types';

type RecentActivityRow = Pick<
	Database['public']['Tables']['staff_notifications']['Row'],
	'id' | 'kind' | 'tone' | 'title' | 'detail' | 'href' | 'created_at'
>;

export const load: PageServerLoad = async ({ locals }) => {
	const roleResult = await resolveAppRole(locals);

	if (!isStaffRole(roleResult)) {
		throw redirect(303, '/access-denied');
	}

	const role = roleResult as StaffRole;
	const { session } = await locals.safeGetSession();
	const user = session?.user;
	const issues: string[] = [];

	const [membersResult, bookingsResult, conversationsResult, pendingAccessResult, recentActivityResult] =
		await Promise.all([
			locals.supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
			locals.supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
			locals.supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
			locals.supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.eq('role', 'member')
				.eq('user_state', 'conversation_complete'),
			user
				? locals.supabase
						.from('staff_notifications')
						.select('id, kind, tone, title, detail, href, created_at')
						.eq('recipient_id', user.id)
						.order('created_at', { ascending: false })
						.limit(5)
				: Promise.resolve({
						data: [] as RecentActivityRow[],
						error: { message: 'No active session found for recent activity.' }
					})
		]);

	for (const result of [membersResult, bookingsResult, conversationsResult, pendingAccessResult]) {
		if (result.error) {
			issues.push(result.error.message);
		}
	}

	if (recentActivityResult.error) {
		issues.push(recentActivityResult.error.message);
	}

	return {
		role,
		stats: {
			totalMembers: membersResult.count ?? 0,
			activeBookings: bookingsResult.count ?? 0,
			completedConversations: conversationsResult.count ?? 0,
			pendingCommunityAccess: pendingAccessResult.count ?? 0
		},
		recentActivity: ((recentActivityResult.data ?? []) as RecentActivityRow[]).map((item) => ({
			id: item.id,
			kind: item.kind,
			tone: item.tone,
			title: item.title,
			detail: item.detail,
			href: item.href,
			createdAt: item.created_at
		})),
		issues,
		realtimeTarget: 'bookings'
	};
};
