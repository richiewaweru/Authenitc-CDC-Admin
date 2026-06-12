import { redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { getUserSummary, getVisibleSidebarItems, isStaffRole, type AppRole } from '$lib/types';
import type { LayoutServerLoad } from './$types';

const PUBLIC_ROUTES = new Set(['/login', '/access-denied', '/auth/callback']);

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	const pathname = url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.has(pathname);

	if (!session || !user) {
		if (!isPublicRoute) {
			throw redirect(303, '/login');
		}

		return {
			layoutMode: 'plain',
			session: null,
			role: null,
			user: null,
			navigation: []
		};
	}

	const role = (await resolveAppRole(locals)) as AppRole | null;

	if (!isStaffRole(role)) {
		if (pathname !== '/access-denied') {
			throw redirect(303, '/access-denied');
		}

		return {
			layoutMode: 'plain',
			session,
			role,
			user: getUserSummary(user),
			navigation: []
		};
	}

	if (isPublicRoute) {
		throw redirect(303, '/');
	}

	return {
		layoutMode: 'app',
		session,
		role,
		user: getUserSummary(user),
		navigation: getVisibleSidebarItems(role)
	};
};
