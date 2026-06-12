import type { AppRole } from '$lib/types';

export async function resolveAppRole(locals: App.Locals): Promise<AppRole | null> {
	if (locals.role) {
		return locals.role;
	}

	const { data, error } = await locals.supabase.rpc('get_my_role');

	if (error || !data) {
		return null;
	}

	const role = data as AppRole;
	locals.role = role;
	return role;
}
