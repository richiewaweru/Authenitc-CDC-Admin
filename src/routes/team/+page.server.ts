import { fail, redirect } from '@sveltejs/kit';

import { getHigherRole } from '$lib/server/roleHierarchy';
import { resolveAppRole } from '$lib/server/roles';
import { getSupabaseAdminClient } from '$lib/supabase-admin';
import type { AppRole, Database } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type InviteRow = Database['public']['Tables']['invites']['Row'];
type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];

type StaffInviteRole = 'moderator' | 'guide';
type GuideAccountState = 'linked' | 'pending_setup' | 'profile_only';
type AuthUserLike = {
	id: string;
	email?: string;
	email_confirmed_at?: string | null;
	app_metadata?: Record<string, unknown>;
};
type MemberCandidate = {
	id: string;
	email: string;
	label: string;
	onboardingComplete: boolean;
	joinedAt: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: FormDataEntryValue | null) {
	return value?.toString().trim().toLowerCase() ?? '';
}

function buildInitials(name: string) {
	const parts = name
		.split(/[\s._-]+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 2);

	if (parts.length === 0) {
		return 'T';
	}

	return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getProfileLabel(profile: Pick<ProfileRow, 'display_name' | 'email'>) {
	if (profile.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile.email) {
		return profile.email.split('@')[0];
	}

	return 'Unknown account';
}

function getGuideLabel(guide: Pick<GuideRow, 'display_name' | 'name' | 'email'>) {
	if (guide.display_name?.trim()) {
		return guide.display_name.trim();
	}

	if (guide.name?.trim()) {
		return guide.name.trim();
	}

	if (guide.email) {
		return guide.email.split('@')[0];
	}

	return 'Unnamed guide';
}

function getGuideAccountState(
	guide: Pick<GuideRow, 'user_id' | 'email'>,
	pendingInviteEmails: ReadonlySet<string>
): GuideAccountState {
	if (guide.email && pendingInviteEmails.has(guide.email.toLowerCase())) {
		return 'pending_setup';
	}

	if (guide.user_id) {
		return 'linked';
	}

	if (guide.email) {
		return 'pending_setup';
	}

	return 'profile_only';
}

async function findAuthUserByEmail(email: string) {
	const adminSupabase = getSupabaseAdminClient();
	let page = 1;

	while (true) {
		const { data, error } = await adminSupabase.auth.admin.listUsers({
			page,
			perPage: 200
		});

		if (error) {
			throw new Error(`Could not search auth users: ${error.message}`);
		}

		const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

		if (match) {
			return match as AuthUserLike;
		}

		if (data.users.length < 200) {
			return null;
		}

		page += 1;
	}
}

async function stampPendingStaffRole(userId: string, role: StaffInviteRole) {
	const adminSupabase = getSupabaseAdminClient();
	const {
		data: { user },
		error: userError
	} = await adminSupabase.auth.admin.getUserById(userId);

	if (userError || !user) {
		throw new Error(userError?.message ?? 'Could not load the invited user.');
	}

	const { error: metadataError } = await adminSupabase.auth.admin.updateUserById(userId, {
		app_metadata: {
			...(user.app_metadata ?? {}),
			pending_staff_role: role
		}
	});

	if (metadataError) {
		throw new Error(metadataError.message);
	}
}

async function syncGuideProfile(params: {
	userId: string;
	email: string;
	guideName?: string;
	guideTitle?: string;
	callerId: string;
}) {
	const adminSupabase = getSupabaseAdminClient();
	await adminSupabase.from('guide_profiles').delete().eq('email', params.email).is('user_id', null);

	const label = params.guideName?.trim() || params.email.split('@')[0];
	const { error } = await adminSupabase.from('guide_profiles').upsert(
		{
			id: params.userId,
			user_id: params.userId,
			display_name: label,
			name: label,
			email: params.email,
			title: params.guideTitle?.trim() || 'Community Guide',
			initials: buildInitials(label),
			is_active: true,
			created_by: params.callerId
		},
		{ onConflict: 'id' }
	);

	if (error) {
		throw new Error(error.message);
	}
}

async function deleteUnconfirmedAuthUser(email: string) {
	const adminSupabase = getSupabaseAdminClient();
	const existingUser = await findAuthUserByEmail(email);

	if (!existingUser || existingUser.email_confirmed_at) {
		return;
	}

	const { error } = await adminSupabase.auth.admin.deleteUser(existingUser.id);

	if (error) {
		throw new Error(error.message);
	}
}

async function generateInviteLink(email: string, redirectTo: string) {
	const adminSupabase = getSupabaseAdminClient();
	const { data, error } = await adminSupabase.auth.admin.generateLink({
		type: 'invite',
		email,
		options: {
			redirectTo
		}
	});

	if (error || !data?.properties?.action_link || !data.user?.id) {
		throw new Error(error?.message ?? 'Could not generate the invite link.');
	}

	return {
		link: data.properties.action_link,
		userId: data.user.id
	};
}

async function createOrRefreshStaffAccess(params: {
	email: string;
	role: StaffInviteRole;
	callerId: string;
	redirectTo: string;
	createGuideProfile?: boolean;
	guideName?: string;
	guideTitle?: string;
}) {
	const adminSupabase = getSupabaseAdminClient();
	const existingUser = await findAuthUserByEmail(params.email);
	const shouldSyncGuideProfile =
		params.role === 'guide' || (params.role === 'moderator' && params.createGuideProfile);

	if (existingUser?.email_confirmed_at) {
		const { data: profile, error: profileError } = await adminSupabase
			.from('profiles')
			.select('id, role, email, display_name')
			.eq('id', existingUser.id)
			.maybeSingle();

		if (profileError) {
			throw new Error(profileError.message);
		}

		if (!profile) {
			throw new Error('The existing account does not have a profile row yet.');
		}

		if (profile.role === 'admin') {
			throw new Error('Admin accounts cannot be reassigned from Team management.');
		}

		const nextRole = getHigherRole(profile.role, params.role);

		if (profile.role !== nextRole) {
			const { error: updateError } = await adminSupabase
				.from('profiles')
				.update({ role: nextRole, updated_at: new Date().toISOString() })
				.eq('id', profile.id);

			if (updateError) {
				throw new Error(updateError.message);
			}
		}

		if (shouldSyncGuideProfile) {
			await syncGuideProfile({
				userId: profile.id,
				email: params.email,
				guideName: params.guideName,
				guideTitle: params.guideTitle,
				callerId: params.callerId
			});
		}

		return {
			success: true,
			alreadyRegistered: true,
			message:
				profile.role === nextRole
					? `${params.email} already has ${nextRole} access.`
					: `${params.email} now has ${nextRole} access.`
		};
	}

	await adminSupabase.from('invites').delete().eq('email', params.email).eq('role', params.role).is('accepted_at', null);
	await deleteUnconfirmedAuthUser(params.email);

	const { error: inviteError } = await adminSupabase.from('invites').insert({
		email: params.email,
		role: params.role,
		invited_by: params.callerId
	});

	if (inviteError) {
		throw new Error(inviteError.message);
	}

	const inviteLinkData = await generateInviteLink(params.email, params.redirectTo);
	await stampPendingStaffRole(inviteLinkData.userId, params.role);

	if (shouldSyncGuideProfile) {
		try {
			await syncGuideProfile({
				userId: inviteLinkData.userId,
				email: params.email,
				guideName: params.guideName,
				guideTitle: params.guideTitle,
				callerId: params.callerId
			});
		} catch (guideError) {
			await adminSupabase.from('invites').delete().eq('email', params.email).eq('role', params.role).is('accepted_at', null);
			await adminSupabase.auth.admin.deleteUser(inviteLinkData.userId);
			throw guideError;
		}
	}

	return {
		success: true,
		message:
			params.role === 'moderator'
				? `Invite prepared for ${params.email}. They will be assigned moderator access when they finish setup.`
				: `Invite prepared for ${params.email}. They will finish guide setup from the secure link.`,
		inviteLink: inviteLinkData.link,
		inviteEmail: params.email,
		inviteRole: params.role
	};
}

async function revokePendingInvite(inviteId: string) {
	const adminSupabase = getSupabaseAdminClient();
	const { data: invite, error: inviteError } = await adminSupabase
		.from('invites')
		.select('id, email, role, accepted_at')
		.eq('id', inviteId)
		.maybeSingle();

	if (inviteError) {
		throw new Error(inviteError.message);
	}

	if (!invite) {
		throw new Error('Invite not found.');
	}

	if (invite.accepted_at) {
		throw new Error('Accepted invites can no longer be revoked from this view.');
	}

	const { error: deleteInviteError } = await adminSupabase.from('invites').delete().eq('id', inviteId);

	if (deleteInviteError) {
		throw new Error(deleteInviteError.message);
	}

	if (invite.role === 'guide') {
		await adminSupabase
			.from('guide_profiles')
			.delete()
			.eq('email', invite.email)
			.is('user_id', null);
	}

	await deleteUnconfirmedAuthUser(invite.email);

	return {
		success: true,
		message: `Invite for ${invite.email} has been revoked.`
	};
}

async function removeModerator(callerId: string, moderatorId: string) {
	const adminSupabase = getSupabaseAdminClient();

	if (callerId === moderatorId) {
		throw new Error('Use another admin account if you need to remove your own moderator access.');
	}

	const { data: moderator, error: moderatorError } = await adminSupabase
		.from('profiles')
		.select('id, email, display_name, role')
		.eq('id', moderatorId)
		.maybeSingle();

	if (moderatorError) {
		throw new Error(moderatorError.message);
	}

	if (!moderator || moderator.role !== 'moderator') {
		throw new Error('Moderator not found.');
	}

	const { error: updateError } = await adminSupabase
		.from('profiles')
		.update({
			role: 'member',
			updated_at: new Date().toISOString()
		})
		.eq('id', moderatorId);

	if (updateError) {
		throw new Error(updateError.message);
	}

	return {
		success: true,
		message: `${getProfileLabel(moderator)} was returned to the member role.`
	};
}

async function loadTeamData(currentAdminId: string) {
	const adminSupabase = getSupabaseAdminClient();
	const [staffResult, invitesResult, guidesResult, membersResult] = await Promise.all([
		adminSupabase
			.from('profiles')
			.select(
				'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
			)
			.neq('role', 'member')
			.order('role')
			.order('created_at', { ascending: true }),
		adminSupabase
			.from('invites')
			.select('id, email, role, invited_by, accepted_at, created_at')
			.is('accepted_at', null)
			.order('created_at', { ascending: false }),
		adminSupabase
			.from('guide_profiles')
			.select(
				'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
			)
			.order('created_at', { ascending: true }),
		adminSupabase
			.from('profiles')
			.select('id, email, display_name, onboarding_complete, created_at')
			.eq('role', 'member')
			.order('created_at', { ascending: false })
	]);

	const issues = [staffResult.error, invitesResult.error, guidesResult.error, membersResult.error]
		.filter(Boolean)
		.map((issue) => issue?.message ?? 'An unknown team query failed.');

	const staff = (staffResult.data ?? []) as ProfileRow[];
	const invites = (invitesResult.data ?? []) as InviteRow[];
	const guides = (guidesResult.data ?? []) as GuideRow[];
	const members = ((membersResult.data ?? []) as Array<
		Pick<ProfileRow, 'id' | 'email' | 'display_name' | 'onboarding_complete' | 'created_at'>
	>).map((profile) => ({
		id: profile.id,
		email: profile.email ?? 'unknown@authentic.app',
		label: getProfileLabel(profile),
		onboardingComplete: Boolean(profile.onboarding_complete),
		joinedAt: profile.created_at
	})) satisfies MemberCandidate[];

	const pendingGuideInviteEmails = new Set(
		invites
			.filter((invite) => invite.role === 'guide')
			.map((invite) => invite.email.toLowerCase())
	);

	return {
		viewerId: currentAdminId,
		admins: staff
			.filter((member) => member.role === 'admin')
			.map((member) => {
				const linkedGuideProfile = guides.find((guide) => guide.user_id === member.id);

				return {
					id: member.id,
					email: member.email ?? 'unknown@authentic.app',
					label: getProfileLabel(member),
					lastSignInAt: member.last_sign_in_at,
					createdAt: member.created_at,
					isCurrentUser: member.id === currentAdminId,
					hasGuideProfile: Boolean(linkedGuideProfile),
					guideProfileLabel: linkedGuideProfile ? getGuideLabel(linkedGuideProfile) : null,
					guideProfileTitle: linkedGuideProfile?.title ?? null
				};
			}),
		moderators: staff
			.filter((member) => member.role === 'moderator')
			.map((member) => ({
				id: member.id,
				email: member.email ?? 'unknown@authentic.app',
				label: getProfileLabel(member),
				createdAt: member.created_at,
				lastSignInAt: member.last_sign_in_at,
				suspended: member.suspended
			})),
		guides: guides.map((guide) => {
			const accountState = getGuideAccountState(guide, pendingGuideInviteEmails);
			const linkedProfile = staff.find((member) => member.id === guide.user_id);

			return {
				id: guide.id,
				email: guide.email ?? 'unknown@authentic.app',
				label: getGuideLabel(guide),
				title: guide.title ?? 'Community Guide',
				isActive: guide.is_active,
				accountState,
				linkLabel:
					accountState === 'pending_setup'
						? 'Pending setup'
						: accountState === 'linked'
							? 'Linked account'
							: 'Profile only',
				linkedEmail: linkedProfile?.email ?? guide.email ?? 'unknown@authentic.app',
				createdAt: guide.created_at
			};
		}),
		pendingInvites: invites.map((invite) => {
			const linkedGuideProfile =
				guides.find((guide) => guide.email?.toLowerCase() === invite.email.toLowerCase()) ?? null;

			return {
				id: invite.id,
				email: invite.email,
				role: invite.role,
				createdAt: invite.created_at,
				createGuideProfile: invite.role === 'guide' || Boolean(linkedGuideProfile),
				guideName: linkedGuideProfile ? getGuideLabel(linkedGuideProfile) : null,
				guideTitle: linkedGuideProfile?.title ?? null,
				statusNote:
					invite.role === 'guide' && pendingGuideInviteEmails.has(invite.email.toLowerCase())
						? 'Guide setup link is still open.'
						: linkedGuideProfile
							? 'Waiting for the recipient to finish setup. A guide profile is already linked to this invite.'
							: 'Waiting for the recipient to finish setup.'
			};
		}),
		memberCandidates: members,
		issues
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	if ((await resolveAppRole(locals)) !== 'admin') {
		throw redirect(303, '/');
	}

	const { user } = await locals.safeGetSession();

	if (!user) {
		throw redirect(303, '/login');
	}

	return loadTeamData(user.id);
};

export const actions: Actions = {
	addTeamMember: async ({ locals, request, url }) => {
		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can manage team access.' });
		}

		const { user } = await locals.safeGetSession();

		if (!user) {
			return fail(401, { message: 'Your session expired. Please log in again.' });
		}

		const formData = await request.formData();
		const email = normalizeEmail(formData.get('email'));
		const role = formData.get('role')?.toString() === 'guide' ? 'guide' : 'moderator';
		const createGuideProfile = formData.get('createGuideProfile') === 'true';
		const guideName = formData.get('guideName')?.toString().trim() || undefined;
		const guideTitle = formData.get('guideTitle')?.toString().trim() || undefined;

		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { message: 'Enter a valid email address.' });
		}

		try {
			const result = await createOrRefreshStaffAccess({
				email,
				role,
				callerId: user.id,
				redirectTo: new URL('/auth/callback', url.origin).toString(),
				createGuideProfile,
				guideName,
				guideTitle
			});

			return {
				success: true,
				message: result.message,
				inviteLink: result.inviteLink,
				inviteEmail: result.inviteEmail,
				inviteRole: result.inviteRole
			};
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not update team access.'
			});
		}
	},
	refreshInvite: async ({ locals, request, url }) => {
		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can manage team access.' });
		}

		const { user } = await locals.safeGetSession();

		if (!user) {
			return fail(401, { message: 'Your session expired. Please log in again.' });
		}

		const formData = await request.formData();
		const email = normalizeEmail(formData.get('email'));
		const role = formData.get('role')?.toString() === 'guide' ? 'guide' : 'moderator';
		const createGuideProfile = formData.get('createGuideProfile') === 'true';
		const guideName = formData.get('guideName')?.toString().trim() || undefined;
		const guideTitle = formData.get('guideTitle')?.toString().trim() || undefined;

		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { message: 'Enter a valid email address.' });
		}

		try {
			const result = await createOrRefreshStaffAccess({
				email,
				role,
				callerId: user.id,
				redirectTo: new URL('/auth/callback', url.origin).toString(),
				createGuideProfile,
				guideName,
				guideTitle
			});

			return {
				success: true,
				message: result.message.replace('Invite prepared', 'Invite link refreshed'),
				inviteLink: result.inviteLink,
				inviteEmail: result.inviteEmail,
				inviteRole: result.inviteRole
			};
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not refresh the invite.'
			});
		}
	},
	syncAdminGuideProfile: async ({ locals, request }) => {
		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can manage admin guide profiles.' });
		}

		const { user } = await locals.safeGetSession();

		if (!user) {
			return fail(401, { message: 'Your session expired. Please log in again.' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString().trim() ?? '';
		const guideName = formData.get('guideName')?.toString().trim() || undefined;
		const guideTitle = formData.get('guideTitle')?.toString().trim() || undefined;

		if (!adminId) {
			return fail(400, { message: 'Admin id is required.' });
		}

		try {
			const adminSupabase = getSupabaseAdminClient();
			const { data: adminProfile, error: adminError } = await adminSupabase
				.from('profiles')
				.select('id, email, display_name, role')
				.eq('id', adminId)
				.maybeSingle();

			if (adminError) {
				throw new Error(adminError.message);
			}

			if (!adminProfile || adminProfile.role !== 'admin') {
				throw new Error('Admin account not found.');
			}

			if (!adminProfile.email) {
				throw new Error('The selected admin does not have an email address on file.');
			}

			await syncGuideProfile({
				userId: adminProfile.id,
				email: adminProfile.email,
				guideName: guideName ?? adminProfile.display_name ?? undefined,
				guideTitle,
				callerId: user.id
			});

			return {
				success: true,
				message: `Guide profile saved for ${getProfileLabel(adminProfile)}.`
			};
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not save the admin guide profile.'
			});
		}
	},
	revokeInvite: async ({ locals, request }) => {
		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can manage team access.' });
		}

		const formData = await request.formData();
		const inviteId = formData.get('inviteId')?.toString().trim() ?? '';

		if (!inviteId) {
			return fail(400, { message: 'Invite id is required.' });
		}

		try {
			return await revokePendingInvite(inviteId);
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not revoke the invite.'
			});
		}
	},
	removeModerator: async ({ locals, request }) => {
		if ((await resolveAppRole(locals)) !== 'admin') {
			return fail(403, { message: 'Only admins can manage moderators.' });
		}

		const { user } = await locals.safeGetSession();

		if (!user) {
			return fail(401, { message: 'Your session expired. Please log in again.' });
		}

		const formData = await request.formData();
		const moderatorId = formData.get('moderatorId')?.toString().trim() ?? '';

		if (!moderatorId) {
			return fail(400, { message: 'Moderator id is required.' });
		}

		try {
			return await removeModerator(user.id, moderatorId);
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not remove moderator access.'
			});
		}
	}
};
