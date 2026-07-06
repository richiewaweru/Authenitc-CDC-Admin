import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type GuideProfileRow = Database['public']['Tables']['guide_profiles']['Row'];

async function getMyGuideId(locals: App.Locals) {
	const { data, error } = await locals.supabase.rpc('get_my_guide_id');

	if (error) {
		return { guideId: null, error: error.message };
	}

	return { guideId: data as string | null, error: null };
}

export const load: PageServerLoad = async ({ locals }) => {
	const role = await resolveAppRole(locals);

	if (!isStaffRole(role)) {
		throw redirect(303, '/access-denied');
	}

	const { guideId, error } = await getMyGuideId(locals);
	const guideResult =
		guideId
			? await locals.supabase
					.from('guide_profiles')
					.select('id, user_id, email, name, display_name, title, avatar_url, initials, bio, is_active, created_at, updated_at, created_by')
					.eq('id', guideId)
					.maybeSingle()
			: { data: null, error: null };

	return {
		role: role as StaffRole,
		guide: guideResult.data as GuideProfileRow | null,
		issues: [error, guideResult.error?.message].filter((value): value is string => Boolean(value))
	};
};

export const actions: Actions = {
	saveGuideBio: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);

		if (!isStaffRole(role)) {
			return fail(403, { message: 'Only staff members can update guide settings.' });
		}

		const { guideId, error } = await getMyGuideId(locals);

		if (error) {
			return fail(500, { message: error });
		}

		if (!guideId) {
			return fail(403, { message: 'Your account is not linked to a guide profile yet.' });
		}

		const formData = await request.formData();
		const bio = formData.get('bio')?.toString().trim() || null;

		if (bio && bio.length > 600) {
			return fail(400, { message: 'Community bio must be 600 characters or fewer.' });
		}

		const { error: updateError } = await locals.supabase
			.from('guide_profiles')
			.update({ bio, updated_at: new Date().toISOString() })
			.eq('id', guideId);

		if (updateError) {
			return fail(500, { message: updateError.message });
		}

		return { success: true, message: 'Community bio saved.' };
	}
};
