import { json } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import type { AppNotification } from '$lib/stores/notifications';
import { isStaffRole, type StaffRole } from '$lib/types';
import type { RequestHandler } from './$types';

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

	const { data, error } = await locals.supabase
		.from('staff_notifications')
		.select('id, kind, tone, title, detail, href, read, created_at')
		.eq('recipient_id', user.id)
		.gt('created_at', since)
		.order('created_at', { ascending: true })
		.limit(20);

	if (error) {
		return json({ notifications: [] }, { status: 500 });
	}

	const notifications: AppNotification[] = (data ?? []).map((row) => ({
		id: row.id,
		kind: row.kind as AppNotification['kind'],
		tone: row.tone as AppNotification['tone'],
		title: row.title,
		detail: row.detail,
		href: row.href,
		createdAt: row.created_at,
		read: row.read
	}));

	return json({ notifications });
};
