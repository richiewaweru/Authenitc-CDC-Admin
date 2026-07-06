import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface InviteRequest {
	action?: 'invite' | 'resend' | 'revoke' | 'finalize';
	email?: string;
	role?: 'moderator' | 'guide';
	guideName?: string;
	guideTitle?: string;
	inviteId?: string;
}

type AppRole = 'admin' | 'moderator' | 'guide' | 'member';

const ROLE_RANK: Record<AppRole, number> = {
	member: 0,
	guide: 1,
	moderator: 2,
	admin: 3
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

function getRequiredEnv(name: string): string {
	const value = Deno.env.get(name);
	if (!value) {
		throw new Error(`${name} is not configured`);
	}

	return value;
}

function getInviteRedirectUrl(): string {
	const adminAppUrl = getRequiredEnv('ADMIN_APP_URL');
	return new URL('/auth/callback', `${adminAppUrl.replace(/\/+$/, '')}/`).toString();
}

function getHigherRole(currentRole: AppRole | null | undefined, requestedRole: 'moderator' | 'guide') {
	if (!currentRole) {
		return requestedRole;
	}

	return ROLE_RANK[currentRole] >= ROLE_RANK[requestedRole] ? currentRole : requestedRole;
}

async function syncGuideProfile(
	adminClient: ReturnType<typeof createClient>,
	params: {
		userId: string;
		email: string;
		guideName?: string;
		guideTitle?: string;
		callerId: string;
	}
) {
	await adminClient.from('guide_profiles').delete().eq('email', params.email).is('user_id', null);

	const { error } = await adminClient.from('guide_profiles').upsert(
		{
			id: params.userId,
			user_id: params.userId,
			display_name: params.guideName || params.email.split('@')[0],
			name: params.guideName || params.email.split('@')[0],
			email: params.email,
			title: params.guideTitle || 'Community Guide',
			is_active: true,
			created_by: params.callerId
		},
		{ onConflict: 'id' }
	);

	if (error) {
		throw error;
	}
}

async function sendStaffInvite(
	adminClient: ReturnType<typeof createClient>,
	email: string,
	role: 'moderator' | 'guide',
	redirectTo: string
): Promise<string> {
	const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
		redirectTo,
		data: {
			pending_staff_role: role
		}
	});

	if (error || !data.user?.id) {
		throw error ?? new Error('Could not send the invite email');
	}

	return data.user.id;
}

async function stampPendingStaffRole(
	adminClient: ReturnType<typeof createClient>,
	userId: string,
	role: 'moderator' | 'guide'
) {
	const {
		data: { user },
		error: userError
	} = await adminClient.auth.admin.getUserById(userId);

	if (userError || !user) {
		throw userError ?? new Error('Could not load the invited user.');
	}

	const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
		app_metadata: {
			...(user.app_metadata ?? {}),
			pending_staff_role: role
		}
	});

	if (metadataError) {
		throw metadataError;
	}
}

async function finalizeStaffInvite(
	adminClient: ReturnType<typeof createClient>,
	caller: { id: string; email?: string | null; app_metadata?: Record<string, unknown> }
) {
	const pendingRole =
		caller.app_metadata?.pending_staff_role === 'guide' ||
		caller.app_metadata?.pending_staff_role === 'moderator'
			? (caller.app_metadata.pending_staff_role as 'guide' | 'moderator')
			: null;

	let resolvedRole: 'guide' | 'moderator' | null = pendingRole;

	if (!resolvedRole) {
		const { data: linkedGuide } = await adminClient
			.from('guide_profiles')
			.select('id')
			.eq('user_id', caller.id)
			.maybeSingle();

		if (linkedGuide?.id) {
			resolvedRole = 'guide';
		}
	}

	if (!resolvedRole) {
		return {
			success: true,
			appliedRole: null,
			message: 'No pending staff invite needed finalization.'
		};
	}

	const { data: existingProfile, error: existingProfileError } = await adminClient
		.from('profiles')
		.select('role')
		.eq('id', caller.id)
		.maybeSingle();

	if (existingProfileError) {
		throw existingProfileError;
	}

	const nextRole = getHigherRole(existingProfile?.role as AppRole | null | undefined, resolvedRole);

	const { error: profileError } = await adminClient
		.from('profiles')
		.update({ role: nextRole })
		.eq('id', caller.id);

	if (profileError) {
		throw profileError;
	}

	if (resolvedRole === 'guide' && caller.email) {
		const { error: guideError } = await adminClient
			.from('guide_profiles')
			.update({ user_id: caller.id })
			.eq('email', caller.email);

		if (guideError) {
			throw guideError;
		}
	}

	const {
		data: { user },
		error: userError
	} = await adminClient.auth.admin.getUserById(caller.id);

	if (userError || !user) {
		throw userError ?? new Error('Could not reload the invited user.');
	}

	const nextAppMetadata = { ...(user.app_metadata ?? {}) };
	delete nextAppMetadata.pending_staff_role;

	const { error: metadataError } = await adminClient.auth.admin.updateUserById(caller.id, {
		app_metadata: nextAppMetadata
	});

	if (metadataError) {
		throw metadataError;
	}

	return {
		success: true,
		appliedRole: nextRole,
		message: `Staff role finalized as ${nextRole}.`
	};
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
	const {
		data: { users }
	} = await adminClient.auth.admin.listUsers();

	return users?.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function deleteUnconfirmedAuthUser(adminClient: ReturnType<typeof createClient>, email: string) {
	const existingUser = await findAuthUserByEmail(adminClient, email);

	if (!existingUser || existingUser.email_confirmed_at) {
		return;
	}

	const { error } = await adminClient.auth.admin.deleteUser(existingUser.id);

	if (error) {
		throw error;
	}
}

async function createStaffInvite(
	adminClient: ReturnType<typeof createClient>,
	params: {
		email: string;
		role: 'moderator' | 'guide';
		redirectTo: string;
		callerId: string;
		guideName?: string;
		guideTitle?: string;
	}
) {
	await adminClient
		.from('invites')
		.delete()
		.eq('email', params.email)
		.eq('role', params.role)
		.is('accepted_at', null);
	await deleteUnconfirmedAuthUser(adminClient, params.email);

	let invitedUserId: string;

	try {
		invitedUserId = await sendStaffInvite(adminClient, params.email, params.role, params.redirectTo);
		await stampPendingStaffRole(adminClient, invitedUserId, params.role);
	} catch (inviteError) {
		console.error('Failed to email invite:', inviteError);
		return jsonResponse({ error: 'Failed to email invite' }, 500);
	}

	const { error: inviteRecordError } = await adminClient.from('invites').insert({
		email: params.email,
		role: params.role,
		invited_by: params.callerId
	});

	if (inviteRecordError) {
		console.error('Failed to create invite:', inviteRecordError);
		await adminClient.auth.admin.deleteUser(invitedUserId);
		return jsonResponse({ error: 'Failed to create invite record' }, 500);
	}

	if (params.role === 'guide') {
		try {
			await syncGuideProfile(adminClient, {
				userId: invitedUserId,
				email: params.email,
				guideName: params.guideName,
				guideTitle: params.guideTitle,
				callerId: params.callerId
			});
		} catch (guideError) {
			console.error('Failed to sync guide profile:', guideError);
			await adminClient
				.from('invites')
				.delete()
				.eq('email', params.email)
				.eq('role', params.role)
				.is('accepted_at', null);
			await adminClient.auth.admin.deleteUser(invitedUserId);
			return jsonResponse({ error: 'Failed to create the guide profile' }, 500);
		}
	}

	return jsonResponse({
		success: true,
		message: `Invite emailed to ${params.email}.`
	});
}

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return jsonResponse({ error: 'Missing authorization header' }, 401);
		}

		const callerClient = createClient(
			getRequiredEnv('SUPABASE_URL'),
			getRequiredEnv('SUPABASE_ANON_KEY'),
			{ global: { headers: { Authorization: authHeader } } }
		);

		const {
			data: { user: caller },
			error: authError
		} = await callerClient.auth.getUser();

		if (authError || !caller) {
			return jsonResponse({ error: 'Invalid session' }, 401);
		}

		const adminClient = createClient(
			getRequiredEnv('SUPABASE_URL'),
			getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
		);

		const redirectTo = getInviteRedirectUrl();
		const body: InviteRequest = await req.json();
		const action = body.action || 'invite';

		if (action === 'finalize') {
			try {
				const result = await finalizeStaffInvite(adminClient, caller);
				return jsonResponse(result);
			} catch (finalizeError) {
				console.error('Failed to finalize staff invite:', finalizeError);
				return jsonResponse({ error: 'Failed to finalize the staff invite.' }, 500);
			}
		}

		const { data: callerProfile } = await callerClient
			.from('profiles')
			.select('role')
			.eq('id', caller.id)
			.single();

		if (callerProfile?.role !== 'admin') {
			return jsonResponse({ error: 'Only admins can manage staff invites' }, 403);
		}

		if (action === 'revoke') {
			const { inviteId } = body;

			if (!inviteId) {
				return jsonResponse({ error: 'inviteId is required for revoke' }, 400);
			}

			const { data: invite } = await adminClient
				.from('invites')
				.select('id, email, role, accepted_at')
				.eq('id', inviteId)
				.maybeSingle();

			if (!invite) {
				return jsonResponse({ error: 'Invite not found' }, 404);
			}

			if (invite.accepted_at) {
				return jsonResponse({ error: 'Cannot revoke an accepted invite' }, 400);
			}

			await adminClient.from('invites').delete().eq('id', inviteId);

			if (invite.role === 'guide') {
				await adminClient
					.from('guide_profiles')
					.delete()
					.eq('email', invite.email);
			}

			const {
				data: { users }
			} = await adminClient.auth.admin.listUsers();
			const stubUser = users?.find((user) => user.email === invite.email && !user.email_confirmed_at);

			if (stubUser) {
				await adminClient.auth.admin.deleteUser(stubUser.id);
			}

			return jsonResponse({
				success: true,
				message: `Invite for ${invite.email} has been revoked.`
			});
		}

		if (action === 'resend') {
			const { email, role, guideName, guideTitle } = body;

			if (!email || !role) {
				return jsonResponse({ error: 'Email and role are required for resend' }, 400);
			}

			return createStaffInvite(adminClient, {
				email,
				role,
				redirectTo,
				callerId: caller.id,
				guideName,
				guideTitle
			});
		}

		const { email, role, guideName, guideTitle } = body;

		if (!email || !role) {
			return jsonResponse({ error: 'Email and role are required' }, 400);
		}

		if (!['moderator', 'guide'].includes(role)) {
			return jsonResponse({ error: 'Role must be moderator or guide' }, 400);
		}

		const existingUser = await findAuthUserByEmail(adminClient, email);

		if (existingUser?.email_confirmed_at) {
			const { data: existingProfile, error: existingProfileError } = await adminClient
				.from('profiles')
				.select('role')
				.eq('id', existingUser.id)
				.maybeSingle();

			if (existingProfileError) {
				console.error('Failed to load existing profile role:', existingProfileError);
				return jsonResponse({ error: 'Failed to check the existing account role.' }, 500);
			}

			const nextRole = getHigherRole(existingProfile?.role as AppRole | null | undefined, role);
			const { error: updateError } = await adminClient
				.from('profiles')
				.update({ role: nextRole })
				.eq('id', existingUser.id);

			if (updateError) {
				console.error('Failed to update existing profile role:', updateError);
				return jsonResponse({ error: 'Failed to update the existing account role.' }, 500);
			}

			if (role === 'guide') {
				await syncGuideProfile(adminClient, {
					userId: existingUser.id,
					email,
					guideName,
					guideTitle,
					callerId: caller.id
				});
			}

			return jsonResponse({
				success: true,
				message:
					nextRole === role
						? `${email} already registered. Role updated to ${nextRole}.`
						: `${email} already registered. Existing higher role ${nextRole} was preserved.`,
				alreadyRegistered: true
			});
		}

		return createStaffInvite(adminClient, {
			email,
			role,
			redirectTo,
			callerId: caller.id,
			guideName,
			guideTitle
		});
	} catch (err) {
		console.error('Unexpected error:', err);
		const message = err instanceof Error ? err.message : 'Internal server error';
		return jsonResponse({ error: message }, 500);
	}
});
