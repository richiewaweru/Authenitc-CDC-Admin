import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { toUtcIsoString } from '$lib/server/timezone';
import type { SlotStatus } from '$lib/types/database';
import { isStaffRole, type Database, type StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];
type SlotRow = Database['public']['Tables']['available_slots']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_TIME_ROWS = ['09:00', '10:30', '13:00', '14:30', '16:00'];
const VIEW_OPTIONS = new Set(['calendar', 'list']);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAFF_EDITABLE_SLOT_STATUSES = new Set<SlotStatus>(['open', 'cancelled']);

function formatDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseDateKey(value: string | null) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(base: Date, amount: number) {
	const next = new Date(base);
	next.setDate(next.getDate() + amount);
	return next;
}

function startOfWeek(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	const offset = (next.getDay() + 6) % 7;
	next.setDate(next.getDate() - offset);
	return next;
}

function endOfWorkWeek(weekStart: Date) {
	const friday = addDays(weekStart, 4);
	friday.setHours(23, 59, 59, 999);
	return friday;
}

function normalizeView(value: string | null) {
	return value && VIEW_OPTIONS.has(value) ? (value as 'calendar' | 'list') : 'calendar';
}

function normalizeGuideFilter(value: string | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : 'all';
}

function normalizeTimeKey(value: string | null) {
	if (!value) {
		return null;
	}

	const match = value.match(/^(\d{2}):(\d{2})/);
	return match ? `${match[1]}:${match[2]}` : null;
}

function formatTimeLabel(timeKey: string) {
	const [hoursText, minutesText] = timeKey.split(':');
	const hours = Number.parseInt(hoursText, 10);
	const minutes = Number.parseInt(minutesText, 10);

	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		return timeKey;
	}

	const suffix = hours >= 12 ? 'PM' : 'AM';
	const normalizedHour = hours % 12 || 12;
	return `${normalizedHour}:${minutesText} ${suffix}`;
}

function formatWeekLabel(weekStart: Date, weekEnd: Date) {
	const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
	const monthPrefix = MONTH_LABELS[weekStart.getMonth()];
	const endPrefix = sameMonth ? '' : `${MONTH_LABELS[weekEnd.getMonth()]} `;

	return `${monthPrefix} ${weekStart.getDate()} - ${endPrefix}${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
}

function buildDayLabel(date: Date) {
	return `${WEEKDAY_LABELS[date.getDay()]} ${date.getDate()}`;
}

function getGuideLabel(guide?: Pick<GuideRow, 'display_name' | 'name' | 'email'> | null) {
	if (guide?.display_name?.trim()) {
		return guide.display_name.trim();
	}

	if (guide?.name?.trim()) {
		return guide.name.trim();
	}

	if (guide?.email) {
		return guide.email.split('@')[0];
	}

	return 'Unknown guide';
}

function getGuideInitials(guide?: Pick<GuideRow, 'initials' | 'display_name' | 'name' | 'email'> | null) {
	if (guide?.initials?.trim()) {
		return guide.initials.trim().slice(0, 2).toUpperCase();
	}

	const label = getGuideLabel(guide);
	const initials = label
		.split(/\s+/)
		.map((part) => part.charAt(0))
		.join('')
		.slice(0, 2)
		.toUpperCase();

	return initials || 'G';
}

function getMemberLabel(profile?: Pick<ProfileRow, 'display_name' | 'email'> | null) {
	if (profile?.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile?.email) {
		return profile.email.split('@')[0];
	}

	return 'Unassigned member';
}

function getProfileLabel(profile?: Pick<ProfileRow, 'display_name' | 'email'> | null) {
	if (profile?.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile?.email) {
		return profile.email.split('@')[0];
	}

	return 'Unknown staff member';
}

function buildSlotTone(status: SlotStatus | null) {
	switch (status) {
		case 'booked':
			return 'warning';
		case 'completed':
			return 'info';
		case 'cancelled':
		case 'expired':
			return 'danger';
		default:
			return 'success';
	}
}

function isWeekend(date: Date) {
	const day = date.getDay();
	return day === 0 || day === 6;
}

function uniqueStrings(values: Array<string | null | undefined>) {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeDuration(value: string | null) {
	const parsed = Number.parseInt(value ?? '30', 10);
	return Number.isNaN(parsed) || parsed < 15 ? 30 : parsed;
}

async function getMyGuideId(locals: App.Locals) {
	const { data, error } = await locals.supabase.rpc('get_my_guide_id');

	if (error) {
		return { guideId: null, error: error.message };
	}

	return { guideId: data, error: null };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const resolvedRole = await resolveAppRole(locals);

	if (!isStaffRole(resolvedRole)) {
		throw redirect(303, '/access-denied');
	}

	const role = resolvedRole as StaffRole;
	const view = normalizeView(url.searchParams.get('view'));
	const requestedWeek = parseDateKey(url.searchParams.get('week'));
	const weekStart = startOfWeek(requestedWeek ?? new Date());
	const weekEnd = endOfWorkWeek(weekStart);
	const guideFilter = normalizeGuideFilter(url.searchParams.get('guide'));
	const hasGuideFilter = url.searchParams.has('guide');
	const issues: string[] = [];

	let myGuideId: string | null = null;

	if (role === 'guide' || role === 'admin' || role === 'moderator') {
		const { guideId, error } = await getMyGuideId(locals);

		if (error) {
			issues.push(error);
		} else {
			myGuideId = guideId;
		}
	}

	const scopedGuideId = role === 'guide' ? myGuideId ?? EMPTY_GUIDE_ID : null;

	const guidesQuery =
		role === 'guide'
			? locals.supabase
					.from('guide_profiles')
					.select(
						'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
					)
					.eq('id', scopedGuideId ?? EMPTY_GUIDE_ID)
			: locals.supabase
					.from('guide_profiles')
					.select(
						'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
					)
					.order('is_active', { ascending: false })
					.order('display_name', { ascending: true, nullsFirst: false });

	const guidesResult = await guidesQuery;

	if (guidesResult.error) {
		issues.push(guidesResult.error.message);
	}

	const guides = ((guidesResult.data ?? []) as GuideRow[]).map((guide) => ({
		id: guide.id,
		label: getGuideLabel(guide),
		title: guide.title ?? 'Community Guide',
		isActive: guide.is_active
	}));

	const activeGuideFilter =
		role === 'guide'
			? scopedGuideId ?? 'all'
			: !hasGuideFilter && myGuideId
				? myGuideId
				: guideFilter !== 'all'
					? guideFilter
					: 'all';

	let slotsQuery = locals.supabase
		.from('available_slots')
		.select(
			'id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by, modified_by'
		)
		.gte('slot_date', formatDateKey(weekStart))
		.lte('slot_date', formatDateKey(weekEnd))
		.order('slot_date', { ascending: true })
		.order('slot_time', { ascending: true, nullsFirst: false });

	if (activeGuideFilter !== 'all') {
		slotsQuery = slotsQuery.eq('guide_id', activeGuideFilter);
	}

	const slotsResult = await slotsQuery;

	if (slotsResult.error) {
		issues.push(slotsResult.error.message);
	}

	const slotRows = (slotsResult.data ?? []) as SlotRow[];
	const slotIds = slotRows.map((slot) => slot.id);
	const bookingResult =
		slotIds.length > 0
			? await locals.supabase
					.from('bookings')
					.select(
						'id, user_id, guide_id, slot_id, meeting_link, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
					)
					.in('slot_id', slotIds)
			: { data: [] as BookingRow[], error: null };

	if (bookingResult.error) {
		issues.push(bookingResult.error.message);
	}

	const bookingRows = (bookingResult.data ?? []) as BookingRow[];
	const bookingBySlotId = new Map(bookingRows.map((booking) => [booking.slot_id, booking]));

	const memberIds = uniqueStrings([
		...slotRows.map((slot) => slot.booked_by),
		...bookingRows.map((booking) => booking.user_id),
		...slotRows.map((slot) => slot.created_by),
		...slotRows.map((slot) => slot.modified_by)
	]);
	const guideIds = uniqueStrings([...slotRows.map((slot) => slot.guide_id), ...guides.map((guide) => guide.id)]);

	const profilesResult =
		memberIds.length > 0
			? await locals.supabase
					.from('profiles')
					.select(
						'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
					)
					.in('id', memberIds)
			: { data: [] as ProfileRow[], error: null };

	if (profilesResult.error) {
		issues.push(profilesResult.error.message);
	}

	const relatedGuidesResult =
		guideIds.length > 0
			? await locals.supabase
					.from('guide_profiles')
					.select(
						'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
					)
					.in('id', guideIds)
			: { data: [] as GuideRow[], error: null };

	if (relatedGuidesResult.error) {
		issues.push(relatedGuidesResult.error.message);
	}

	const profilesMap = new Map(
		((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
	);
	const guidesMap = new Map(
		((relatedGuidesResult.data ?? []) as GuideRow[]).map((guide) => [guide.id, guide])
	);

	const weekDays = Array.from({ length: 5 }, (_, index) => {
		const date = addDays(weekStart, index);
		return {
			date: formatDateKey(date),
			label: buildDayLabel(date),
			fullLabel: `${WEEKDAY_LABELS[date.getDay()]}, ${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`
		};
	});

	const slotItems = slotRows.map((slot) => {
		const guide = guidesMap.get(slot.guide_id);
		const booking = bookingBySlotId.get(slot.id);
		const member = profilesMap.get(booking?.user_id ?? slot.booked_by ?? '');
		const timeKey = normalizeTimeKey(slot.slot_time) ?? '00:00';

		return {
			id: slot.id,
			guideId: slot.guide_id,
			guideLabel: getGuideLabel(guide),
			guideInitials: getGuideInitials(guide),
			isOwnSlot: myGuideId ? slot.guide_id === myGuideId : false,
			memberLabel:
				slot.status === 'booked' || slot.status === 'completed'
					? getMemberLabel(member)
					: 'Open for booking',
			slotDate: slot.slot_date ?? '',
			timeKey,
			timeLabel: formatTimeLabel(timeKey),
			durationMinutes: slot.duration_minutes ?? 30,
			status: slot.status ?? 'open',
			statusTone: buildSlotTone(slot.status ?? 'open'),
			startsAt: slot.starts_at,
			createdBy: slot.created_by,
			modifiedBy: slot.modified_by,
			modifiedByLabel:
				slot.modified_by && slot.modified_by !== slot.created_by
					? getProfileLabel(profilesMap.get(slot.modified_by))
					: null,
			bookingId: booking?.id ?? null,
			bookingStatus: booking?.status ?? null,
			paymentStatus: booking?.payment_status ?? null,
			meetingLink: booking?.meeting_link ?? null
		};
	});

	const allTimeRows = [...new Set([...DEFAULT_TIME_ROWS, ...slotItems.map((slot) => slot.timeKey)])].sort();
	const calendarRows = allTimeRows.map((timeKey) => ({
		timeKey,
		timeLabel: formatTimeLabel(timeKey),
		cells: weekDays.map((day) => ({
			date: day.date,
			items: slotItems.filter((slot) => slot.slotDate === day.date && slot.timeKey === timeKey)
		}))
	}));

	const summary = slotItems.reduce(
		(acc, slot) => {
			acc.total += 1;
			acc[slot.status] += 1;
			return acc;
		},
		{ total: 0, open: 0, booked: 0, completed: 0, cancelled: 0, expired: 0 }
	);

	return {
		role,
		canPublish: role === 'admin' || role === 'moderator' || role === 'guide',
		publishDisabledReason:
			role === 'guide' && !myGuideId
				? 'Your account is not linked to a guide profile yet.'
				: (role === 'admin' || role === 'moderator') && !myGuideId
					? 'Your account is not linked to a guide profile. Ask an admin to create one from the Team page.'
				: null,
		myGuideId,
		guides,
		filters: {
			view,
			guide: activeGuideFilter
		},
		week: {
			start: formatDateKey(weekStart),
			end: formatDateKey(weekEnd),
			label: formatWeekLabel(weekStart, weekEnd),
			prevStart: formatDateKey(addDays(weekStart, -7)),
			nextStart: formatDateKey(addDays(weekStart, 7))
		},
		weekDays,
		calendarRows,
		listSlots: slotItems,
		timeOptions: DEFAULT_TIME_ROWS.map((timeKey) => ({
			value: timeKey,
			label: formatTimeLabel(timeKey)
		})),
		summary,
		issues
	};
};

export const actions: Actions = {
	publishSlots: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);
		const isGuide = role === 'guide';
		const isStaff = role === 'admin' || role === 'moderator';

		if (!isStaff && !isGuide) {
			return fail(403, { message: 'Only staff members can publish slots.' });
		}

		const { session } = await locals.safeGetSession();
		const formData = await request.formData();
		const guideId = formData.get('guideId')?.toString().trim() ?? '';
		const startDate = formData.get('startDate')?.toString().trim() ?? '';
		const endDate = formData.get('endDate')?.toString().trim() ?? '';
		const duration = normalizeDuration(formData.get('duration')?.toString() ?? '30');
		const excludeWeekends = formData.get('excludeWeekends') === 'on';
		const customTime = normalizeTimeKey(formData.get('customTime')?.toString().trim() ?? null);
		const selectedTimes = uniqueStrings(
			formData.getAll('times').map((value) => normalizeTimeKey(value.toString()))
		);
		const timeKeys = uniqueStrings(customTime ? [...selectedTimes, customTime] : selectedTimes);

		let resolvedGuideId = guideId;

		if (isGuide) {
			const { guideId: myGuideId, error } = await getMyGuideId(locals);

			if (error) {
				return fail(500, { message: error });
			}

			if (!myGuideId) {
				return fail(403, { message: 'Your account is not linked to a guide profile yet.' });
			}

			resolvedGuideId = myGuideId;
		}

		if (!resolvedGuideId) {
			return fail(400, { message: 'Choose a guide before publishing slots.' });
		}

		const parsedStart = parseDateKey(startDate);
		const parsedEnd = parseDateKey(endDate);

		if (!parsedStart || !parsedEnd) {
			return fail(400, { message: 'Choose a valid date range for the slot publish window.' });
		}

		if (parsedEnd < parsedStart) {
			return fail(400, { message: 'The end date must be on or after the start date.' });
		}

		if (timeKeys.length === 0) {
			return fail(400, { message: 'Choose at least one time slot to publish.' });
		}

		const { data: guide, error: guideError } = await locals.supabase
			.from('guide_profiles')
			.select('id, display_name, name, email, is_active')
			.eq('id', resolvedGuideId)
			.maybeSingle();

		if (guideError) {
			return fail(500, { message: guideError.message });
		}

		if (!guide) {
			return fail(404, { message: 'That guide could not be found.' });
		}

		const { data: existingSlots, error: existingSlotsError } = await locals.supabase
			.from('available_slots')
			.select('id, slot_date, slot_time')
			.eq('guide_id', resolvedGuideId)
			.gte('slot_date', startDate)
			.lte('slot_date', endDate);

		if (existingSlotsError) {
			return fail(500, { message: existingSlotsError.message });
		}

		const existingKeys = new Set(
			((existingSlots ?? []) as Array<Pick<SlotRow, 'slot_date' | 'slot_time'>>)
				.map((slot) => {
					const timeKey = normalizeTimeKey(slot.slot_time);
					return slot.slot_date && timeKey ? `${slot.slot_date}_${timeKey}` : null;
				})
				.filter((value): value is string => Boolean(value))
		);

		const slotPayloads: Database['public']['Tables']['available_slots']['Insert'][] = [];
		let skippedCount = 0;

		for (let cursor = new Date(parsedStart); cursor <= parsedEnd; cursor = addDays(cursor, 1)) {
			if (excludeWeekends && isWeekend(cursor)) {
				continue;
			}

			const dateKey = formatDateKey(cursor);

			for (const timeKey of timeKeys) {
				const slotKey = `${dateKey}_${timeKey}`;

				if (existingKeys.has(slotKey)) {
					skippedCount += 1;
					continue;
				}

				slotPayloads.push({
					guide_id: resolvedGuideId,
					slot_date: dateKey,
					slot_time: `${timeKey}:00`,
					starts_at: toUtcIsoString(dateKey, timeKey),
					duration_minutes: duration,
					status: 'open',
					created_by: session?.user.id ?? null,
					created_at: new Date().toISOString()
				});
			}
		}

		if (slotPayloads.length === 0) {
			return {
				success: true,
				message: `No new slots were created for ${getGuideLabel(guide)}. ${skippedCount} duplicates were skipped.`
			};
		}

		const { error: insertError } = await locals.supabase.from('available_slots').insert(slotPayloads);

		if (insertError) {
			return fail(500, { message: insertError.message });
		}

		return {
			success: true,
			message: `${slotPayloads.length} slots were published for ${getGuideLabel(guide)}.${skippedCount > 0 ? ` ${skippedCount} duplicates were skipped.` : ''}`
		};
	},
	updateSlotStatus: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);
		const isStaff = role === 'admin' || role === 'moderator';
		const isGuide = role === 'guide';

		if (!isStaff && !isGuide) {
			return fail(403, { message: 'Only staff members can update slot status.' });
		}

		const formData = await request.formData();
		const { session } = await locals.safeGetSession();
		const slotId = formData.get('slotId')?.toString().trim() ?? '';
		const nextStatusValue = formData.get('status')?.toString().trim() ?? '';

		if (!slotId || !STAFF_EDITABLE_SLOT_STATUSES.has(nextStatusValue as SlotStatus)) {
			return fail(400, { message: 'Choose a valid slot and status update.' });
		}

		const nextStatus = nextStatusValue as SlotStatus;

		const { data: slot, error: slotError } = await locals.supabase
			.from('available_slots')
			.select('id, status, guide_id, slot_date, slot_time')
			.eq('id', slotId)
			.maybeSingle();

		if (slotError) {
			return fail(500, { message: slotError.message });
		}

		if (!slot) {
			return fail(404, { message: 'That slot could not be found.' });
		}

		if (isGuide) {
			const { guideId: myGuideId, error } = await getMyGuideId(locals);

			if (error) {
				return fail(500, { message: error });
			}

			if (!myGuideId) {
				return fail(403, { message: 'Your account is not linked to a guide profile yet.' });
			}

			if (slot.guide_id !== myGuideId) {
				return fail(403, { message: 'You can only update your own slots.' });
			}
		}

		if (!STAFF_EDITABLE_SLOT_STATUSES.has((slot.status ?? 'open') as SlotStatus)) {
			return fail(400, {
				message: 'Only open or cancelled slots can be changed from this screen right now.'
			});
		}

		const { error: updateError } = await locals.supabase
			.from('available_slots')
			.update({ status: nextStatus, modified_by: session?.user.id ?? null })
			.eq('id', slotId);

		if (updateError) {
			return fail(500, { message: updateError.message });
		}

		return {
			success: true,
			message: `Slot ${slot.slot_date ?? ''} ${normalizeTimeKey(slot.slot_time) ? formatTimeLabel(normalizeTimeKey(slot.slot_time)!) : ''} is now ${nextStatus}.`
		};
	},
	updateMeetingLink: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);
		const isStaff = role === 'admin' || role === 'moderator';
		const isGuide = role === 'guide';

		if (!isStaff && !isGuide) {
			return fail(403, { message: 'Only staff members can update meeting links.' });
		}

		const formData = await request.formData();
		const { session } = await locals.safeGetSession();
		const bookingId = formData.get('bookingId')?.toString().trim() ?? '';
		const meetingLink = formData.get('meetingLink')?.toString().trim() ?? '';

		if (!bookingId) {
			return fail(400, { message: 'Booking id is required.' });
		}

		if (meetingLink && !meetingLink.startsWith('https://')) {
			return fail(400, { message: 'Please enter a valid https:// link.' });
		}

		const { data: booking, error: bookingError } = await locals.supabase
			.from('bookings')
			.select('id, guide_id, slot_id')
			.eq('id', bookingId)
			.maybeSingle();

		if (bookingError) {
			return fail(500, { message: bookingError.message });
		}

		if (!booking) {
			return fail(404, { message: 'That booking could not be found.' });
		}

		if (isGuide) {
			const { guideId: myGuideId, error } = await getMyGuideId(locals);

			if (error) {
				return fail(500, { message: error });
			}

			if (!myGuideId) {
				return fail(403, { message: 'Your account is not linked to a guide profile yet.' });
			}

			if (booking.guide_id !== myGuideId) {
				return fail(403, {
					message: 'You can only update meeting links for your own bookings.'
				});
			}
		}

		const { error } = await locals.supabase
			.from('bookings')
			.update({ meeting_link: meetingLink || null, updated_at: new Date().toISOString() })
			.eq('id', bookingId);

		if (error) {
			return fail(500, { message: error.message });
		}

		const { error: slotUpdateError } = await locals.supabase
			.from('available_slots')
			.update({ modified_by: session?.user.id ?? null })
			.eq('id', booking.slot_id);

		if (slotUpdateError) {
			return fail(500, { message: slotUpdateError.message });
		}

		return { success: true, message: 'Meeting link saved.' };
	},
	deleteSlot: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);
		const isStaff = role === 'admin' || role === 'moderator';
		const isGuide = role === 'guide';

		if (!isStaff && !isGuide) {
			return fail(403, { message: 'Only staff members can remove slots.' });
		}

		const formData = await request.formData();
		const slotId = formData.get('slotId')?.toString().trim() ?? '';

		if (!slotId) {
			return fail(400, { message: 'Slot id is required.' });
		}

		const { data: slot, error: slotError } = await locals.supabase
			.from('available_slots')
			.select('id, status, guide_id, slot_date, slot_time')
			.eq('id', slotId)
			.maybeSingle();

		if (slotError) {
			return fail(500, { message: slotError.message });
		}

		if (!slot) {
			return fail(404, { message: 'That slot no longer exists.' });
		}

		if (isGuide) {
			const { guideId: myGuideId, error } = await getMyGuideId(locals);

			if (error) {
				return fail(500, { message: error });
			}

			if (!myGuideId) {
				return fail(403, { message: 'Your account is not linked to a guide profile yet.' });
			}

			if (slot.guide_id !== myGuideId) {
				return fail(403, { message: 'You can only remove your own slots.' });
			}
		}

		if (!STAFF_EDITABLE_SLOT_STATUSES.has((slot.status ?? 'open') as SlotStatus)) {
			return fail(400, {
				message: 'Booked or completed slots cannot be removed from this screen.'
			});
		}

		const { error: deleteError } = await locals.supabase.from('available_slots').delete().eq('id', slotId);

		if (deleteError) {
			return fail(500, { message: deleteError.message });
		}

		return {
			success: true,
			message: `Removed slot ${slot.slot_date ?? ''} ${normalizeTimeKey(slot.slot_time) ? formatTimeLabel(normalizeTimeKey(slot.slot_time)!) : ''}.`
		};
	}
};
