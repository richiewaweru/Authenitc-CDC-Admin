import { PUBLIC_SUPABASE_URL } from '$env/static/public';

import { getSupabaseBrowserClient } from '$lib/supabase';
import type { AppRole } from '$lib/types';

export interface InviteStaffParams {
	email: string;
	role: 'moderator' | 'guide';
	guideName?: string;
	guideTitle?: string;
}

export interface InviteResponse {
	success: boolean;
	message: string;
	alreadyRegistered?: boolean;
}

export interface AdminApiError {
	error: string;
	status: number;
}

export interface TeamStaffMember {
	id: string;
	email: string | null;
	display_name: string | null;
	role: AppRole;
	suspended: boolean;
	last_sign_in_at: string | null;
	created_at: string | null;
}

export interface TeamPendingInvite {
	id: string;
	email: string;
	role: AppRole;
	invited_by: string;
	accepted_at: string | null;
	created_at: string | null;
}

export interface TeamGuideProfile {
	id: string;
	user_id: string | null;
	email: string | null;
	name: string | null;
	display_name: string | null;
	title: string | null;
	is_active: boolean;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
	const supabase = getSupabaseBrowserClient();
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		throw { error: 'You must be logged in.', status: 401 } satisfies AdminApiError;
	}

	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${session.access_token}`
	};
}

async function callEdgeFunction<T>(functionName: string, body: object): Promise<T> {
	const headers = await getAuthHeaders();

	const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});

	const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

	if (!response.ok) {
		throw {
			error:
				typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.',
			status: response.status
		} satisfies AdminApiError;
	}

	return data as T;
}

export async function inviteStaff(params: InviteStaffParams): Promise<InviteResponse> {
	return callEdgeFunction<InviteResponse>('admin-invite-staff', params);
}

export async function resendInvite(
	email: string,
	role: 'moderator' | 'guide',
	guideName?: string,
	guideTitle?: string
): Promise<InviteResponse> {
	return callEdgeFunction<InviteResponse>('admin-invite-staff', {
		action: 'resend',
		email,
		role,
		guideName,
		guideTitle
	});
}

export async function revokeInvite(inviteId: string): Promise<{ success: boolean }> {
	return callEdgeFunction<{ success: boolean }>('admin-invite-staff', {
		action: 'revoke',
		inviteId
	});
}

export async function fetchTeamData(): Promise<{
	staff: TeamStaffMember[];
	pendingInvites: TeamPendingInvite[];
	guideProfiles: TeamGuideProfile[];
	errors: unknown[];
}> {
	const supabase = getSupabaseBrowserClient();

	const [staffResult, invitesResult, guidesResult] = await Promise.all([
		supabase
			.from('profiles')
			.select('id, email, display_name, role, suspended, last_sign_in_at, created_at')
			.neq('role', 'member')
			.order('role')
			.order('created_at', { ascending: true }),

		supabase
			.from('invites')
			.select('id, email, role, invited_by, accepted_at, created_at')
			.is('accepted_at', null)
			.order('created_at', { ascending: false }),

		supabase
			.from('guide_profiles')
			.select('id, user_id, email, name, display_name, title, is_active')
	]);

	return {
		staff: staffResult.data ?? [],
		pendingInvites: invitesResult.data ?? [],
		guideProfiles: guidesResult.data ?? [],
		errors: [staffResult.error, invitesResult.error, guidesResult.error].filter(Boolean)
	};
}

export function isAdminApiError(err: unknown): err is AdminApiError {
	return (
		typeof err === 'object' &&
		err !== null &&
		'error' in err &&
		'status' in err &&
		typeof (err as AdminApiError).error === 'string'
	);
}

export function getErrorMessage(err: unknown): string {
	if (isAdminApiError(err)) {
		switch (err.status) {
			case 401:
				return 'Your session has expired. Please log in again.';
			case 403:
				return 'Only admins can manage team invites.';
			case 404:
				return 'This invite could not be found.';
			case 409:
				return 'This email already has a pending invite.';
			default:
				return err.error;
		}
	}

	if (err instanceof Error) {
		return err.message;
	}

	return 'Something went wrong. Please try again.';
}
