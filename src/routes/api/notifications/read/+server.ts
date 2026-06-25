import { json } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const role = await resolveAppRole(locals);

	if (!isStaffRole(role)) {
		return json({ ok: false }, { status: 403 });
	}

	const { user } = await locals.safeGetSession();

	if (!user) {
		return json({ ok: false }, { status: 401 });
	}

	const body = (await request.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
	const ids = Array.isArray(body.ids)
		? body.ids.filter((value): value is string => typeof value === 'string')
		: [];
	const markAll = body.all === true;

	if (!markAll && ids.length === 0) {
		return json({ ok: true, updated: 0 });
	}

	let query = locals.supabase
		.from('staff_notifications')
		.update({ read: true }, { count: 'exact' })
		.eq('recipient_id', user.id)
		.eq('read', false);

	if (!markAll) {
		query = query.in('id', ids);
	}

	const { error, count } = await query;

	if (error) {
		return json({ ok: false, error: error.message }, { status: 500 });
	}

	return json({ ok: true, updated: count ?? 0 });
};
