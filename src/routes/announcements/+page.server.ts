import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import type { AnnouncementTone, Database, StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type AnnouncementInsert = Database['public']['Tables']['announcements']['Insert'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];

const TONES: AnnouncementTone[] = ['info', 'celebration', 'reminder', 'alert'];

function optionalText(value: FormDataEntryValue | null) {
	const text = value?.toString().trim() ?? '';
	return text || null;
}

function normalizeTone(value: string | null) {
	return value && TONES.includes(value as AnnouncementTone) ? (value as AnnouncementTone) : 'info';
}

function parsePayload(formData: FormData, userId: string | null): { payload?: AnnouncementInsert; error?: string } {
	const title = optionalText(formData.get('title')) ?? '';
	const body = optionalText(formData.get('body')) ?? '';
	const tone = normalizeTone(formData.get('tone')?.toString() ?? null);
	const pinned = formData.get('pinned') === 'on';
	const published = formData.get('published') === 'on';
	const expiresAt = optionalText(formData.get('expiresAt'));

	if (title.length < 3 || title.length > 100) {
		return { error: 'Announcement title must be between 3 and 100 characters.' };
	}

	if (body.length < 1 || body.length > 500) {
		return { error: 'Announcement body must be between 1 and 500 characters.' };
	}

	if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
		return { error: 'Choose a valid expiry date.' };
	}

	return {
		payload: {
			title,
			body,
			tone,
			pinned,
			published,
			expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
			created_by: userId
		}
	};
}

async function requireEditor(locals: App.Locals) {
	const role = await resolveAppRole(locals);
	return role === 'admin' || role === 'moderator' ? role : null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const role = await requireEditor(locals);

	if (!role) {
		throw redirect(303, '/access-denied');
	}

	const { data, error } = await locals.supabase
		.from('announcements')
		.select('id, title, body, tone, published, pinned, expires_at, created_by, created_at, updated_at')
		.order('pinned', { ascending: false })
		.order('created_at', { ascending: false });

	const rows = ((data ?? []) as AnnouncementRow[]).sort((left, right) => {
		const leftExpired = left.expires_at ? new Date(left.expires_at) <= new Date() : false;
		const rightExpired = right.expires_at ? new Date(right.expires_at) <= new Date() : false;
		if (leftExpired === rightExpired) {
			return 0;
		}
		return leftExpired ? 1 : -1;
	});

	return {
		role: role as StaffRole,
		announcements: rows,
		tones: TONES,
		issues: error ? [error.message] : []
	};
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can save announcements.' });
		}

		const { session } = await locals.safeGetSession();
		const formData = await request.formData();
		const announcementId = optionalText(formData.get('announcementId'));
		const parsed = parsePayload(formData, session?.user.id ?? null);

		if (parsed.error || !parsed.payload) {
			return fail(400, { message: parsed.error ?? 'Could not save this announcement.' });
		}

		if (announcementId) {
			const { id: _id, created_by: _createdBy, ...updatePayload } = parsed.payload;
			const { error } = await locals.supabase.from('announcements').update(updatePayload).eq('id', announcementId);

			if (error) {
				return fail(500, { message: error.message });
			}

			return { success: true, message: 'Announcement updated.' };
		}

		const { error } = await locals.supabase.from('announcements').insert(parsed.payload);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Announcement created.' };
	},
	delete: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can delete announcements.' });
		}

		const formData = await request.formData();
		const announcementId = optionalText(formData.get('announcementId'));

		if (!announcementId) {
			return fail(400, { message: 'Announcement id is required.' });
		}

		const { error } = await locals.supabase.from('announcements').delete().eq('id', announcementId);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Announcement deleted.' };
	},
	togglePin: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can pin announcements.' });
		}

		const formData = await request.formData();
		const announcementId = optionalText(formData.get('announcementId'));
		const pinned = formData.get('pinned') === 'true';

		if (!announcementId) {
			return fail(400, { message: 'Announcement id is required.' });
		}

		const { error } = await locals.supabase.from('announcements').update({ pinned: !pinned }).eq('id', announcementId);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: !pinned ? 'Announcement pinned.' : 'Announcement unpinned.' };
	},
	togglePublish: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can publish announcements.' });
		}

		const formData = await request.formData();
		const announcementId = optionalText(formData.get('announcementId'));
		const published = formData.get('published') === 'true';

		if (!announcementId) {
			return fail(400, { message: 'Announcement id is required.' });
		}

		const { error } = await locals.supabase
			.from('announcements')
			.update({ published: !published })
			.eq('id', announcementId);

		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: !published ? 'Announcement published.' : 'Announcement unpublished.' };
	}
};
