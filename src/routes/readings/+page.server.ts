import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import type { Database, ReadingCategory, StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type ReadingInsert = Database['public']['Tables']['community_readings']['Insert'];
type ReadingRow = Database['public']['Tables']['community_readings']['Row'];

const STATUS_FILTERS = new Set(['all', 'published', 'drafts']);
const CATEGORIES: ReadingCategory[] = ['Faith', 'Relationships', 'Community', 'General'];

function optionalText(value: FormDataEntryValue | null) {
	const text = value?.toString().trim() ?? '';
	return text || null;
}

function normalizeStatus(value: string | null) {
	return value && STATUS_FILTERS.has(value) ? (value as 'all' | 'published' | 'drafts') : 'all';
}

function normalizeCategory(value: string | null) {
	return value && CATEGORIES.includes(value as ReadingCategory) ? (value as ReadingCategory) : null;
}

function parseReadingPayload(formData: FormData, userId: string | null): { payload?: ReadingInsert; error?: string } {
	const title = optionalText(formData.get('title')) ?? '';
	const body = optionalText(formData.get('body'));
	const externalUrl = optionalText(formData.get('externalUrl'));
	const category = normalizeCategory(formData.get('category')?.toString() ?? null) ?? 'General';
	const published = formData.get('published') === 'on';

	if (title.length < 3 || title.length > 120) {
		return { error: 'Reading title must be between 3 and 120 characters.' };
	}

	if (body && body.length > 10000) {
		return { error: 'Reading body must be 10,000 characters or fewer.' };
	}

	if (externalUrl && !externalUrl.startsWith('https://')) {
		return { error: 'External URL must start with https://.' };
	}

	if (!body && !externalUrl) {
		return { error: 'Add body text or an external URL before saving.' };
	}

	return {
		payload: {
			title,
			body,
			external_url: externalUrl,
			category,
			published,
			created_by: userId
		}
	};
}

async function requireEditor(locals: App.Locals) {
	const role = await resolveAppRole(locals);
	return role === 'admin' || role === 'moderator' ? role : null;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const role = await requireEditor(locals);

	if (!role) {
		throw redirect(303, '/access-denied');
	}

	const status = normalizeStatus(url.searchParams.get('status'));
	const category = normalizeCategory(url.searchParams.get('category'));
	let query = locals.supabase
		.from('community_readings')
		.select('id, title, body, external_url, category, published, published_at, created_by, created_at, updated_at')
		.order('created_at', { ascending: false });

	if (status === 'published') {
		query = query.eq('published', true);
	} else if (status === 'drafts') {
		query = query.eq('published', false);
	}

	if (category) {
		query = query.eq('category', category);
	}

	const { data, error } = await query;

	return {
		role: role as StaffRole,
		readings: (data ?? []) as ReadingRow[],
		status,
		category,
		categories: CATEGORIES,
		issues: error ? [error.message] : []
	};
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can save readings.' });
		}

		const { session } = await locals.safeGetSession();
		const formData = await request.formData();
		const readingId = optionalText(formData.get('readingId'));
		const parsed = parseReadingPayload(formData, session?.user.id ?? null);

		if (parsed.error || !parsed.payload) {
			return fail(400, { message: parsed.error ?? 'Could not save this reading.' });
		}

		if (readingId) {
			const { id: _id, created_by: _createdBy, ...updatePayload } = parsed.payload;
			const { error } = await locals.supabase.from('community_readings').update(updatePayload).eq('id', readingId);

			if (error) {
				return fail(500, { message: error.message });
			}

			return { success: true, message: 'Reading updated.' };
		}

		const { error } = await locals.supabase.from('community_readings').insert(parsed.payload);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Reading created.' };
	},
	delete: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can delete readings.' });
		}

		const formData = await request.formData();
		const readingId = optionalText(formData.get('readingId'));

		if (!readingId) {
			return fail(400, { message: 'Reading id is required.' });
		}

		const { error } = await locals.supabase.from('community_readings').delete().eq('id', readingId);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Reading deleted.' };
	},
	togglePublish: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can publish readings.' });
		}

		const formData = await request.formData();
		const readingId = optionalText(formData.get('readingId'));
		const published = formData.get('published') === 'true';

		if (!readingId) {
			return fail(400, { message: 'Reading id is required.' });
		}

		const { error } = await locals.supabase
			.from('community_readings')
			.update({ published: !published })
			.eq('id', readingId);

		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: !published ? 'Reading published.' : 'Reading unpublished.' };
	}
};
