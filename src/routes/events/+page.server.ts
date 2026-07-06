import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type EventInsert = Database['public']['Tables']['community_events']['Insert'];
type EventRow = Database['public']['Tables']['community_events']['Row'];

const FILTERS = new Set(['all', 'upcoming', 'past', 'drafts']);

function normalizeFilter(value: string | null) {
	return value && FILTERS.has(value) ? (value as 'all' | 'upcoming' | 'past' | 'drafts') : 'all';
}

function optionalText(value: FormDataEntryValue | null) {
	const text = value?.toString().trim() ?? '';
	return text || null;
}

function validateHttpsUrl(value: string | null, label: string) {
	if (value && !value.startsWith('https://')) {
		return `${label} must start with https://.`;
	}

	return null;
}

function parseEventPayload(formData: FormData, userId: string | null): { payload?: EventInsert; error?: string } {
	const title = optionalText(formData.get('title')) ?? '';
	const description = optionalText(formData.get('description'));
	const eventDate = optionalText(formData.get('eventDate')) ?? '';
	const durationMinutes = Number.parseInt(formData.get('durationMinutes')?.toString() ?? '60', 10);
	const location = optionalText(formData.get('location'));
	const meetingLink = optionalText(formData.get('meetingLink'));
	const coverImageUrl = optionalText(formData.get('coverImageUrl'));
	const published = formData.get('published') === 'on';

	if (title.length < 3 || title.length > 120) {
		return { error: 'Event title must be between 3 and 120 characters.' };
	}

	if (description && description.length > 2000) {
		return { error: 'Event description must be 2,000 characters or fewer.' };
	}

	if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
		return { error: 'Choose a valid event date and time.' };
	}

	if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
		return { error: 'Duration must be greater than zero minutes.' };
	}

	if (location && location.length > 200) {
		return { error: 'Location must be 200 characters or fewer.' };
	}

	const urlError = validateHttpsUrl(meetingLink, 'Meeting link') ?? validateHttpsUrl(coverImageUrl, 'Cover image URL');
	if (urlError) {
		return { error: urlError };
	}

	return {
		payload: {
			title,
			description,
			event_date: new Date(eventDate).toISOString(),
			duration_minutes: durationMinutes,
			location,
			meeting_link: meetingLink,
			cover_image_url: coverImageUrl,
			published,
			created_by: userId
		}
	};
}

async function requireEditor(locals: App.Locals) {
	const role = await resolveAppRole(locals);

	if (role !== 'admin' && role !== 'moderator') {
		return null;
	}

	return role;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const role = await resolveAppRole(locals);

	if (!isStaffRole(role)) {
		throw redirect(303, '/access-denied');
	}

	const filter = normalizeFilter(url.searchParams.get('filter'));
	const now = new Date().toISOString();
	let query = locals.supabase
		.from('community_events')
		.select('id, title, description, event_date, duration_minutes, location, meeting_link, cover_image_url, published, created_by, created_at, updated_at')
		.order('event_date', { ascending: false });

	if (filter === 'upcoming') {
		query = query.gte('event_date', now).eq('published', true);
	} else if (filter === 'past') {
		query = query.lt('event_date', now);
	} else if (filter === 'drafts') {
		query = query.eq('published', false);
	}

	const { data, error } = await query;

	return {
		role: role as StaffRole,
		canEdit: role === 'admin' || role === 'moderator',
		events: (data ?? []) as EventRow[],
		filter,
		issues: error ? [error.message] : []
	};
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can save events.' });
		}

		const { session } = await locals.safeGetSession();
		const formData = await request.formData();
		const eventId = optionalText(formData.get('eventId'));
		const parsed = parseEventPayload(formData, session?.user.id ?? null);

		if (parsed.error || !parsed.payload) {
			return fail(400, { message: parsed.error ?? 'Could not save this event.' });
		}

		if (eventId) {
			const { id: _id, created_by: _createdBy, ...updatePayload } = parsed.payload;
			const { error } = await locals.supabase.from('community_events').update(updatePayload).eq('id', eventId);

			if (error) {
				return fail(500, { message: error.message });
			}

			return { success: true, message: 'Event updated.' };
		}

		const { error } = await locals.supabase.from('community_events').insert(parsed.payload);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Event created.' };
	},
	delete: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can delete events.' });
		}

		const formData = await request.formData();
		const eventId = optionalText(formData.get('eventId'));

		if (!eventId) {
			return fail(400, { message: 'Event id is required.' });
		}

		const { error } = await locals.supabase.from('community_events').delete().eq('id', eventId);
		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: 'Event deleted.' };
	},
	togglePublish: async ({ locals, request }) => {
		const role = await requireEditor(locals);
		if (!role) {
			return fail(403, { message: 'Only admins and moderators can publish events.' });
		}

		const formData = await request.formData();
		const eventId = optionalText(formData.get('eventId'));
		const published = formData.get('published') === 'true';

		if (!eventId) {
			return fail(400, { message: 'Event id is required.' });
		}

		const { error } = await locals.supabase
			.from('community_events')
			.update({ published: !published })
			.eq('id', eventId);

		if (error) {
			return fail(500, { message: error.message });
		}

		return { success: true, message: !published ? 'Event published.' : 'Event unpublished.' };
	}
};
