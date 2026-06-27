import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { fail, redirect } from '@sveltejs/kit';

import { shouldDemoteGuideProfileRemoval } from '$lib/server/roleHierarchy';
import { resolveAppRole } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';
import type { Database, StaffRole } from '$lib/types';

const PAGE_SIZE = 10;
const GUIDE_STATUSES = new Set(['all', 'active', 'inactive']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GuideProfileRow = Database['public']['Tables']['guide_profiles']['Row'];
type SlotRow = Database['public']['Tables']['available_slots']['Row'];
type InviteFunctionResponse = {
	success?: boolean;
	message?: string;
	error?: string;
	inviteLink?: string;
	inviteEmail?: string;
	inviteRole?: 'guide' | 'moderator';
};
type GuideSummaryRow = Pick<
	GuideProfileRow,
	'id' | 'user_id' | 'email' | 'name' | 'display_name' | 'initials' | 'is_active'
>;
type InviteSummaryRow = Pick<Database['public']['Tables']['invites']['Row'], 'email'>;

type GuideAccountState = 'linked' | 'pending_setup' | 'profile_only';

function normalizeStatus(value: string | null) {
	if (value && GUIDE_STATUSES.has(value)) {
		return value as 'all' | 'active' | 'inactive';
	}

	return 'all';
}

function normalizePage(value: string | null) {
	const parsed = Number.parseInt(value ?? '1', 10);

	if (Number.isNaN(parsed) || parsed < 1) {
		return 1;
	}

	return parsed;
}

function normalizeSearch(value: string | null) {
	return value?.trim() ?? '';
}

function normalizeEmail(value: string | null) {
	const normalized = value?.trim().toLowerCase() ?? '';
	return normalized || null;
}

function buildInitials(name: string) {
	const parts = name
		.split(/[\s_-]+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 2);

	if (parts.length === 0) {
		return 'G';
	}

	return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getGuideLabel(guide: Pick<GuideProfileRow, 'display_name' | 'name' | 'email'>) {
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

function getAccountState(
	guide: Pick<GuideProfileRow, 'user_id' | 'email'>,
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

function applyGuideFilters(
	query: ReturnType<App.Locals['supabase']['from']>,
	status: 'all' | 'active' | 'inactive',
	search: string
) {
	let nextQuery = query;

	if (status === 'active') {
		nextQuery = nextQuery.eq('is_active', true);
	} else if (status === 'inactive') {
		nextQuery = nextQuery.eq('is_active', false);
	}

	if (search) {
		const escaped = search.replace(/,/g, ' ');
		nextQuery = nextQuery.or(
			`display_name.ilike.%${escaped}%,name.ilike.%${escaped}%,email.ilike.%${escaped}%,title.ilike.%${escaped}%`
		);
	}

	return nextQuery;
}

function createSlotStatsMap(slotRows: SlotRow[]) {
	const stats = new Map<
		string,
		{
			open: number;
			booked: number;
			completed: number;
			cancelled: number;
		}
	>();

	for (const slot of slotRows) {
		const current = stats.get(slot.guide_id) ?? {
			open: 0,
			booked: 0,
			completed: 0,
			cancelled: 0
		};

		if (slot.status === 'booked') {
			current.booked += 1;
		} else if (slot.status === 'completed') {
			current.completed += 1;
		} else if (slot.status === 'cancelled') {
			current.cancelled += 1;
		} else {
			current.open += 1;
		}

		stats.set(slot.guide_id, current);
	}

	return stats;
}

async function callAdminInviteFunction(
	accessToken: string,
	body: Record<string, unknown>
) {
	const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/admin-invite-staff`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify(body)
	});

	const data = (await response.json().catch(() => null)) as
		| InviteFunctionResponse
		| null;

	if (!response.ok) {
		throw new Error(data?.error ?? 'Could not send the guide invite.');
	}

	return data;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const role = (await resolveAppRole(locals)) as StaffRole;

	if (role === 'guide') {
		throw redirect(303, '/');
	}

	const status = normalizeStatus(url.searchParams.get('status'));
	const search = normalizeSearch(url.searchParams.get('search'));
	const requestedPage = normalizePage(url.searchParams.get('page'));

	const pageQueryBase = applyGuideFilters(
		locals.supabase
			.from('guide_profiles')
			.select(
				'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by',
				{ count: 'exact' }
			),
		status,
		search
	);

	const totalCountResult = await pageQueryBase;
	const totalCount = totalCountResult.count ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const currentPage = Math.min(requestedPage, totalPages);
	const from = (currentPage - 1) * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;

	const guidesResult = await applyGuideFilters(
		locals.supabase
			.from('guide_profiles')
			.select(
				'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
			)
			.order('is_active', { ascending: false })
			.order('updated_at', { ascending: false, nullsFirst: false })
			.range(from, to),
		status,
		search
	);

	const allGuideSummariesResult = await applyGuideFilters(
		locals.supabase
			.from('guide_profiles')
			.select('id, user_id, email, name, display_name, initials, is_active'),
		status,
		search
	);

	const errors = [totalCountResult.error, guidesResult.error, allGuideSummariesResult.error].filter(Boolean);
	const allGuideRows = (allGuideSummariesResult.data ?? []) as GuideSummaryRow[];
	const allGuideIds = allGuideRows.map((guide) => guide.id);
	const guideEmails = [
		...new Set(
			allGuideRows
				.map((guide) => guide.email?.toLowerCase())
				.filter((email): email is string => Boolean(email))
		)
	];

	const slotsResult =
		allGuideIds.length > 0
			? await locals.supabase
					.from('available_slots')
					.select('id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by')
					.in('guide_id', allGuideIds)
			: { data: [] as SlotRow[], error: null };

	if (slotsResult.error) {
		errors.push(slotsResult.error);
	}

	const pendingInvitesResult =
		guideEmails.length > 0
			? await locals.supabase
					.from('invites')
					.select('email')
					.eq('role', 'guide')
					.is('accepted_at', null)
					.in('email', guideEmails)
			: { data: [] as InviteSummaryRow[], error: null };

	if (pendingInvitesResult.error) {
		errors.push(pendingInvitesResult.error);
	}

	const slotStats = createSlotStatsMap((slotsResult.data ?? []) as SlotRow[]);
	const pendingInviteEmails = new Set(
		((pendingInvitesResult.data ?? []) as InviteSummaryRow[]).map((invite) => invite.email.toLowerCase())
	);

	const guideRows = (guidesResult.data ?? []) as GuideProfileRow[];
	const guides = guideRows.map((guide) => {
		const guideSlots = slotStats.get(guide.id) ?? {
			open: 0,
			booked: 0,
			completed: 0,
			cancelled: 0
		};

		return {
			...guide,
			label: getGuideLabel(guide),
			accountState: getAccountState(guide, pendingInviteEmails),
			openSlots: guideSlots.open,
			bookedSlots: guideSlots.booked,
			completedSlots: guideSlots.completed
		};
	});

	const topPerformer = allGuideRows
		.map((guide) => ({
			id: guide.id,
			label: getGuideLabel(guide),
			initials: guide.initials ?? buildInitials(getGuideLabel(guide)),
			completedSlots: slotStats.get(guide.id)?.completed ?? 0,
			bookedSlots: slotStats.get(guide.id)?.booked ?? 0
		}))
		.sort((left, right) => {
			if (right.completedSlots !== left.completedSlots) {
				return right.completedSlots - left.completedSlots;
			}

			return right.bookedSlots - left.bookedSlots;
		})[0] ?? null;

	const slotTotals = [...slotStats.values()].reduce(
		(acc, value) => {
			acc.open += value.open;
			acc.booked += value.booked;
			acc.completed += value.completed;
			acc.cancelled += value.cancelled;
			return acc;
		},
		{ open: 0, booked: 0, completed: 0, cancelled: 0 }
	);
	const totalTrackedSlots =
		slotTotals.open + slotTotals.booked + slotTotals.completed + slotTotals.cancelled;
	const capacityPercent =
		totalTrackedSlots > 0 ? Math.round((slotTotals.booked / totalTrackedSlots) * 100) : 0;

	return {
		role,
		guides,
		filters: {
			status,
			search
		},
		pagination: {
			page: currentPage,
			pageSize: PAGE_SIZE,
			totalCount,
			totalPages
		},
		summary: {
			totalGuides: allGuideRows.length,
			activeGuides: allGuideRows.filter((guide) => guide.is_active).length,
			pendingSetups: allGuideRows.filter(
				(guide) => getAccountState(guide, pendingInviteEmails) === 'pending_setup'
			).length,
			topPerformer,
			capacityPercent,
			bookedSlots: slotTotals.booked,
			totalTrackedSlots
		},
		issues: errors.map((error) => error?.message ?? 'An unknown guide query failed.')
	};
};

export const actions: Actions = {
	saveGuide: async ({ locals, request }) => {
		const role = (await resolveAppRole(locals)) as StaffRole | null;

		if (!role || (role !== 'admin' && role !== 'moderator')) {
			return fail(403, { message: 'Only staff can manage guides.' });
		}

		const { session } = await locals.safeGetSession();
		const formData = await request.formData();
		const guideId = formData.get('guideId')?.toString().trim() ?? '';
		const displayName = formData.get('displayName')?.toString().trim() ?? '';
		const title = formData.get('title')?.toString().trim() || 'Community Guide';
		const email = normalizeEmail(formData.get('email')?.toString() ?? null);
		const avatarUrl = formData.get('avatarUrl')?.toString().trim() || null;
		const isActive = formData.get('isActive') === 'on';

		if (!displayName) {
			return fail(400, {
				message: 'Guide name is required.',
				values: { guideId, displayName, title, email: email ?? '', avatarUrl: avatarUrl ?? '', isActive }
			});
		}

		if (email && !EMAIL_PATTERN.test(email)) {
			return fail(400, {
				message: 'Enter a valid email address.',
				values: { guideId, displayName, title, email, avatarUrl: avatarUrl ?? '', isActive }
			});
		}

		const payload = {
			display_name: displayName,
			name: displayName,
			title,
			email,
			avatar_url: avatarUrl,
			initials: buildInitials(displayName),
			is_active: isActive,
			updated_at: new Date().toISOString()
		};

		if (guideId) {
			const { error } = await locals.supabase.from('guide_profiles').update(payload).eq('id', guideId);

			if (error) {
				return fail(500, {
					message: error.message,
					values: { guideId, displayName, title, email: email ?? '', avatarUrl: avatarUrl ?? '', isActive }
				});
			}

			return {
				success: true,
				message: `${displayName} was updated.`
			};
		}

		if (role !== 'admin') {
			return fail(403, {
				message: 'Only admins can add new guides because new guide profiles are created through the invite flow.'
			});
		}

		if (!email) {
			return fail(400, {
				message: 'Guide email is required when adding a new guide.',
				values: { guideId, displayName, title, email: '', avatarUrl: avatarUrl ?? '', isActive }
			});
		}

		if (!session) {
			return fail(401, { message: 'Your session expired. Please log in again.' });
		}

		try {
			const inviteResult = await callAdminInviteFunction(session.access_token, {
				email,
				role: 'guide',
				guideName: displayName,
				guideTitle: title
			});

			return {
				success: true,
				message: inviteResult?.message ?? `Invite prepared for ${email}.`,
				inviteLink: inviteResult?.inviteLink,
				inviteEmail: email,
				inviteRole: 'guide' as const
			};
		} catch (error) {
			return fail(500, {
				message: error instanceof Error ? error.message : 'Could not send the guide invite.',
				values: { guideId, displayName, title, email, avatarUrl: avatarUrl ?? '', isActive }
			});
		}

	},
	deleteGuide: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);

		if (role !== 'admin') {
			return fail(403, { message: 'Only admins can delete guides.' });
		}

		const formData = await request.formData();
		const guideId = formData.get('guideId')?.toString().trim() ?? '';

		if (!guideId) {
			return fail(400, { message: 'Guide id is required.' });
		}

		const { data: guide, error: guideError } = await locals.supabase
			.from('guide_profiles')
			.select('id, display_name, name, email, user_id')
			.eq('id', guideId)
			.maybeSingle();

		if (guideError) {
			return fail(500, { message: guideError.message });
		}

		if (!guide) {
			return fail(404, { message: 'Guide not found.' });
		}

		const { session } = await locals.safeGetSession();

		if (guide.email && session) {
			const { data: pendingInvite } = await locals.supabase
				.from('invites')
				.select('id')
				.eq('email', guide.email)
				.eq('role', 'guide')
				.is('accepted_at', null)
				.maybeSingle();

			if (pendingInvite?.id) {
				try {
					await callAdminInviteFunction(session.access_token, {
						action: 'revoke',
						inviteId: pendingInvite.id
					});

					return {
						success: true,
						message: `${getGuideLabel(guide)} was removed from the guide roster.`
					};
				} catch (error) {
					return fail(500, {
						message:
							error instanceof Error
								? error.message
								: 'Could not revoke the pending guide invite.'
					});
				}
			}
		}

		const { error: deleteError } = await locals.supabase.from('guide_profiles').delete().eq('id', guideId);

		if (deleteError) {
			return fail(500, { message: deleteError.message });
		}

		if (guide.user_id) {
			const { data: linkedProfile, error: profileError } = await locals.supabase
				.from('profiles')
				.select('role')
				.eq('id', guide.user_id)
				.maybeSingle();

			if (profileError) {
				return fail(500, {
					message: `Guide profile was deleted, but the linked account role could not be checked: ${profileError.message}`
				});
			}

			if (shouldDemoteGuideProfileRemoval(linkedProfile?.role)) {
				const { error: roleError } = await locals.supabase
					.from('profiles')
					.update({ role: 'member' })
					.eq('id', guide.user_id);

				if (roleError) {
					return fail(500, {
						message: `Guide profile was deleted, but demoting the linked staff role failed: ${roleError.message}`
					});
				}
			}
		}

		if (guide.email && !guide.user_id) {
			await locals.supabase
				.from('invites')
				.delete()
				.eq('email', guide.email)
				.eq('role', 'guide')
				.is('accepted_at', null);
		}

		return {
			success: true,
			message: `${getGuideLabel(guide)} was removed from the guide roster.`
		};
	}
};
