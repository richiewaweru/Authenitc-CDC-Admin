import { PUBLIC_SUPABASE_URL } from '$env/static/public';

import { getSupabaseBrowserClient } from '$lib/supabase';
import type { AppRole } from '$lib/types';

type FinalizeStaffInviteResponse = {
	success: boolean;
	appliedRole: AppRole | null;
	message: string;
};

export async function finalizeStaffInviteSession() {
	const supabase = getSupabaseBrowserClient();
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		throw new Error('You must be signed in to finish staff setup.');
	}

	const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/admin-invite-staff`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.access_token}`
		},
		body: JSON.stringify({ action: 'finalize' })
	});

	const data = (await response.json().catch(() => null)) as
		| (FinalizeStaffInviteResponse & { error?: never })
		| { error?: string }
		| null;

	if (!response.ok) {
		throw new Error(
			typeof data?.error === 'string'
				? data.error
				: 'Could not finish linking your staff access.'
		);
	}

	return data as FinalizeStaffInviteResponse;
}
