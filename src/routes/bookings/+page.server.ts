import { fail, redirect } from '@sveltejs/kit';

import { resolveAppRole } from '$lib/server/roles';
import { isStaffRole, type BookingStatus, type Database, type PaymentStatus, type StaffRole } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SlotRow = Database['public']['Tables']['available_slots']['Row'];
type GuideRow = Database['public']['Tables']['guide_profiles']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type BookingTab = 'all' | 'upcoming' | 'pending_pay';
type DateRangeFilter = 'all' | 'this_week' | 'next_30_days' | 'past';
type BookingListItem = {
	id: string;
	status: BookingStatus;
	paymentStatus: PaymentStatus | 'pending';
	memberId: string;
	memberLabel: string;
	memberEmail: string;
	guideId: string;
	guideLabel: string;
	guideTitle: string;
	slotId: string;
	startsAt: string | null;
	slotDate: string | null;
	slotTime: string | null;
	durationMinutes: number;
	meetingLink: string | null;
	amountPaid: number;
	currency: string;
	cancelledAt: string | null;
	cancelReason: string | null;
	stripePaymentIntentId: string | null;
	canMarkComplete: boolean;
	canCancel: boolean;
};

const EMPTY_GUIDE_ID = '00000000-0000-0000-0000-000000000000';
const PAGE_SIZE = 10;
const TAB_OPTIONS = new Set<BookingTab>(['all', 'upcoming', 'pending_pay']);
const STATUS_OPTIONS = new Set<BookingStatus | 'all'>([
	'all',
	'confirmed',
	'completed',
	'cancelled',
	'no_show'
]);
const PAYMENT_OPTIONS = new Set<PaymentStatus | 'all'>(['all', 'pending', 'paid', 'refunded', 'failed']);
const RANGE_OPTIONS = new Set<DateRangeFilter>(['all', 'this_week', 'next_30_days', 'past']);

function normalizeTab(value: string | null) {
	return value && TAB_OPTIONS.has(value as BookingTab) ? (value as BookingTab) : 'all';
}

function normalizeStatus(value: string | null) {
	return value && STATUS_OPTIONS.has(value as BookingStatus | 'all')
		? (value as BookingStatus | 'all')
		: 'all';
}

function normalizePayment(value: string | null) {
	return value && PAYMENT_OPTIONS.has(value as PaymentStatus | 'all')
		? (value as PaymentStatus | 'all')
		: 'all';
}

function normalizeRange(value: string | null) {
	return value && RANGE_OPTIONS.has(value as DateRangeFilter) ? (value as DateRangeFilter) : 'all';
}

function normalizeGuideFilter(value: string | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : 'all';
}

function normalizeSearch(value: string | null) {
	return value?.trim().toLowerCase() ?? '';
}

function normalizePage(value: string | null) {
	const parsed = Number.parseInt(value ?? '1', 10);
	return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function normalizeBookingId(value: string | null) {
	const trimmed = value?.trim();
	return trimmed || null;
}

function startOfWeek(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	const offset = (next.getDay() + 6) % 7;
	next.setDate(next.getDate() - offset);
	return next;
}

function endOfWeek(date: Date) {
	const next = startOfWeek(date);
	next.setDate(next.getDate() + 6);
	next.setHours(23, 59, 59, 999);
	return next;
}

function addDays(base: Date, amount: number) {
	const next = new Date(base);
	next.setDate(next.getDate() + amount);
	return next;
}

function uniqueStrings(values: Array<string | null | undefined>) {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
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

function getProfileLabel(profile?: Pick<ProfileRow, 'display_name' | 'email'> | null) {
	if (profile?.display_name?.trim()) {
		return profile.display_name.trim();
	}

	if (profile?.email) {
		return profile.email.split('@')[0];
	}

	return 'Unknown member';
}

function isUpcoming(startsAt: string | null, status: BookingStatus) {
	return Boolean(startsAt) && status === 'confirmed' && new Date(startsAt!).getTime() >= Date.now();
}

function matchesDateRange(item: Pick<BookingListItem, 'startsAt'>, range: DateRangeFilter) {
	if (range === 'all') {
		return true;
	}

	if (!item.startsAt) {
		return false;
	}

	const startsAt = new Date(item.startsAt);
	const now = new Date();

	if (range === 'past') {
		return startsAt.getTime() < now.getTime();
	}

	if (range === 'this_week') {
		return startsAt >= startOfWeek(now) && startsAt <= endOfWeek(now);
	}

	return startsAt >= now && startsAt <= addDays(now, 30);
}

function matchesTab(item: BookingListItem, tab: BookingTab) {
	if (tab === 'upcoming') {
		return isUpcoming(item.startsAt, item.status);
	}

	if (tab === 'pending_pay') {
		return item.paymentStatus === 'pending';
	}

	return true;
}

function applyBookingFilters(
	bookings: BookingListItem[],
	params: {
		tab: BookingTab;
		status: BookingStatus | 'all';
		payment: PaymentStatus | 'all';
		range: DateRangeFilter;
		guide: string;
		search: string;
		role: StaffRole;
	}
) {
	return bookings.filter((booking) => {
		if (!matchesTab(booking, params.tab)) {
			return false;
		}

		if (params.status !== 'all' && booking.status !== params.status) {
			return false;
		}

		if (params.payment !== 'all' && booking.paymentStatus !== params.payment) {
			return false;
		}

		if (!matchesDateRange(booking, params.range)) {
			return false;
		}

		if (params.role !== 'guide' && params.guide !== 'all' && booking.guideId !== params.guide) {
			return false;
		}

		if (!params.search) {
			return true;
		}

		const haystack = [
			booking.memberLabel,
			booking.memberEmail,
			booking.guideLabel,
			booking.guideTitle
		]
			.join(' ')
			.toLowerCase();

		return haystack.includes(params.search);
	});
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const resolvedRole = await resolveAppRole(locals);

	if (!isStaffRole(resolvedRole)) {
		throw redirect(303, '/access-denied');
	}

	const role = resolvedRole as StaffRole;
	const tab = normalizeTab(url.searchParams.get('tab'));
	const status = normalizeStatus(url.searchParams.get('status'));
	const payment = normalizePayment(url.searchParams.get('payment'));
	const range = normalizeRange(url.searchParams.get('range'));
	const search = normalizeSearch(url.searchParams.get('search'));
	const requestedPage = normalizePage(url.searchParams.get('page'));
	const selectedBookingId = normalizeBookingId(url.searchParams.get('booking'));
	const requestedGuideFilter = normalizeGuideFilter(url.searchParams.get('guide'));
	const issues: string[] = [];

	let guideId: string | null = null;

	if (role === 'guide') {
		const { data, error } = await locals.supabase.rpc('get_my_guide_id');

		if (error) {
			issues.push(error.message);
		} else {
			guideId = data;
		}
	}

	const scopedGuideId = role === 'guide' ? guideId ?? EMPTY_GUIDE_ID : null;
	const activeGuideFilter = role === 'guide' ? scopedGuideId ?? 'all' : requestedGuideFilter;

	let bookingsQuery = locals.supabase
		.from('bookings')
		.select(
			'id, user_id, guide_id, slot_id, meeting_link, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
		)
		.order('created_at', { ascending: false });

	if (role === 'guide') {
		bookingsQuery = bookingsQuery.eq('guide_id', scopedGuideId ?? EMPTY_GUIDE_ID);
	}

	const bookingsResult = await bookingsQuery;

	if (bookingsResult.error) {
		issues.push(bookingsResult.error.message);
	}

	const bookingRows = (bookingsResult.data ?? []) as BookingRow[];
	const slotIds = uniqueStrings(bookingRows.map((booking) => booking.slot_id));
	const memberIds = uniqueStrings(bookingRows.map((booking) => booking.user_id));
	const guideIds = uniqueStrings(bookingRows.map((booking) => booking.guide_id));

	const slotsResult =
		slotIds.length > 0
			? await locals.supabase
					.from('available_slots')
					.select(
						'id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by'
					)
					.in('id', slotIds)
			: { data: [] as SlotRow[], error: null };

	if (slotsResult.error) {
		issues.push(slotsResult.error.message);
	}

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

	const guidesResult =
		guideIds.length > 0
			? await locals.supabase
					.from('guide_profiles')
					.select(
						'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
					)
					.in('id', guideIds)
			: { data: [] as GuideRow[], error: null };

	if (guidesResult.error) {
		issues.push(guidesResult.error.message);
	}

	let capacitySlotsQuery = locals.supabase
		.from('available_slots')
		.select('id, guide_id, slot_date, slot_time, starts_at, duration_minutes, status, booked_by, booked_at, created_at, created_by');

	if (role === 'guide') {
		capacitySlotsQuery = capacitySlotsQuery.eq('guide_id', scopedGuideId ?? EMPTY_GUIDE_ID);
	} else if (activeGuideFilter !== 'all') {
		capacitySlotsQuery = capacitySlotsQuery.eq('guide_id', activeGuideFilter);
	}

	const capacitySlotsResult = await capacitySlotsQuery;

	if (capacitySlotsResult.error) {
		issues.push(capacitySlotsResult.error.message);
	}

	const profilesMap = new Map(
		((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
	);
	const guidesMap = new Map(
		((guidesResult.data ?? []) as GuideRow[]).map((guide) => [guide.id, guide])
	);
	const slotsMap = new Map(((slotsResult.data ?? []) as SlotRow[]).map((slot) => [slot.id, slot]));

	const bookings = bookingRows.map((booking) => {
		const slot = slotsMap.get(booking.slot_id);
		const member = profilesMap.get(booking.user_id);
		const guide = guidesMap.get(booking.guide_id);
		const bookingStatus = (booking.status ?? 'confirmed') as BookingStatus;
		const paymentStatus = (booking.payment_status ?? 'pending') as PaymentStatus | 'pending';

		return {
			id: booking.id,
			status: bookingStatus,
			paymentStatus,
			memberId: booking.user_id,
			memberLabel: getProfileLabel(member),
			memberEmail: member?.email ?? 'unknown@authentic.app',
			guideId: booking.guide_id,
			guideLabel: getGuideLabel(guide),
			guideTitle: guide?.title ?? 'Community Guide',
			slotId: booking.slot_id,
			startsAt: slot?.starts_at ?? null,
			slotDate: slot?.slot_date ?? null,
			slotTime: slot?.slot_time ?? null,
			durationMinutes: slot?.duration_minutes ?? 30,
			meetingLink: booking.meeting_link ?? null,
			amountPaid: booking.amount_paid ?? 0,
			currency: booking.currency ?? 'usd',
			cancelledAt: booking.cancelled_at,
			cancelReason: booking.cancel_reason,
			stripePaymentIntentId: booking.stripe_payment_intent_id,
			canMarkComplete: bookingStatus === 'confirmed',
			canCancel: role !== 'guide' && bookingStatus === 'confirmed'
		};
	});

	const filteredBookings = applyBookingFilters(bookings, {
		tab,
		status,
		payment,
		range,
		guide: activeGuideFilter,
		search,
		role
	});

	const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
	const currentPage = Math.min(requestedPage, totalPages);
	const from = (currentPage - 1) * PAGE_SIZE;
	const paginatedBookings = filteredBookings.slice(from, from + PAGE_SIZE);

	const selectedBooking = selectedBookingId
		? filteredBookings.find((booking) => booking.id === selectedBookingId) ?? null
		: null;

	const selectedMember = selectedBooking ? profilesMap.get(selectedBooking.memberId) ?? null : null;
	const selectedGuide = selectedBooking ? guidesMap.get(selectedBooking.guideId) ?? null : null;
	const selectedSlot = selectedBooking ? slotsMap.get(selectedBooking.slotId) ?? null : null;

	const allGuides = [...guidesMap.values()]
		.map((guide) => ({
			id: guide.id,
			label: getGuideLabel(guide),
			title: guide.title ?? 'Community Guide'
		}))
		.sort((left, right) => left.label.localeCompare(right.label));

	const tabCounts = {
		all: bookings.length,
		upcoming: bookings.filter((booking) => matchesTab(booking, 'upcoming')).length,
		pending_pay: bookings.filter((booking) => matchesTab(booking, 'pending_pay')).length
	};

	const summary = {
		activeSessions: bookings.filter((booking) => booking.status === 'confirmed').length,
		pendingPayments: bookings.filter((booking) => booking.paymentStatus === 'pending').length,
		capacityPercent: (() => {
			const capacitySlots = (capacitySlotsResult.data ?? []) as SlotRow[];
			if (capacitySlots.length === 0) {
				return 0;
			}

			const filled = capacitySlots.filter(
				(slot) => slot.status === 'booked' || slot.status === 'completed'
			).length;
			return Math.round((filled / capacitySlots.length) * 100);
		})()
	};

	return {
		role,
		bookings: paginatedBookings,
		guides: role === 'guide' ? [] : allGuides,
		filters: {
			tab,
			status,
			payment,
			range,
			guide: activeGuideFilter,
			search
		},
		tabCounts,
		pagination: {
			page: currentPage,
			pageSize: PAGE_SIZE,
			totalCount: filteredBookings.length,
			totalPages
		},
		summary,
		selectedBooking: selectedBooking
			? {
					...selectedBooking,
					memberAvatarUrl: selectedMember?.avatar_url ?? null,
					memberRole: selectedMember?.role ?? 'member',
					guideAvatarUrl: selectedGuide?.avatar_url ?? null,
					guideInitials: selectedGuide?.initials ?? null,
					guideActive: selectedGuide?.is_active ?? true,
					slotStatus: selectedSlot?.status ?? null
				}
			: null,
		issues
	};
};

export const actions: Actions = {
	markComplete: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);

		if (!role || !isStaffRole(role)) {
			return fail(403, { message: 'Only staff can update bookings.' });
		}

		const formData = await request.formData();
		const bookingId = formData.get('bookingId')?.toString().trim() ?? '';

		if (!bookingId) {
			return fail(400, { message: 'Booking id is required.' });
		}

		const { data: booking, error: bookingError } = await locals.supabase
			.from('bookings')
			.select(
				'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
			)
			.eq('id', bookingId)
			.maybeSingle();

		if (bookingError) {
			return fail(500, { message: bookingError.message });
		}

		if (!booking) {
			return fail(404, { message: 'Booking not found.' });
		}

		if ((booking.status ?? 'confirmed') !== 'confirmed') {
			return fail(400, { message: 'Only confirmed bookings can be marked complete.' });
		}

		if (role === 'guide') {
			const { data: guideId, error: guideIdError } = await locals.supabase.rpc('get_my_guide_id');

			if (guideIdError || !guideId || guideId !== booking.guide_id) {
				return fail(403, { message: 'Guide sessions can only update assigned bookings.' });
			}
		}

		const timestamp = new Date().toISOString();

		const { error: updateBookingError } = await locals.supabase
			.from('bookings')
			.update({ status: 'completed', updated_at: timestamp })
			.eq('id', bookingId);

		if (updateBookingError) {
			return fail(500, { message: updateBookingError.message });
		}

		const { error: updateSlotError } = await locals.supabase
			.from('available_slots')
			.update({ status: 'completed' })
			.eq('id', booking.slot_id);

		if (updateSlotError) {
			return fail(500, { message: updateSlotError.message });
		}

		return {
			success: true,
			message: 'Booking marked complete and the linked slot moved to completed.'
		};
	},
	cancelBooking: async ({ locals, request }) => {
		const role = await resolveAppRole(locals);

		if (role !== 'admin' && role !== 'moderator') {
			return fail(403, { message: 'Only admins and moderators can cancel bookings.' });
		}

		const formData = await request.formData();
		const bookingId = formData.get('bookingId')?.toString().trim() ?? '';
		const cancelReason = formData.get('cancelReason')?.toString().trim() ?? '';

		if (!bookingId) {
			return fail(400, { message: 'Booking id is required.' });
		}

		const { data: booking, error: bookingError } = await locals.supabase
			.from('bookings')
			.select(
				'id, user_id, guide_id, slot_id, status, payment_status, stripe_payment_intent_id, amount_paid, currency, cancelled_at, cancel_reason, created_at, updated_at'
			)
			.eq('id', bookingId)
			.maybeSingle();

		if (bookingError) {
			return fail(500, { message: bookingError.message });
		}

		if (!booking) {
			return fail(404, { message: 'Booking not found.' });
		}

		if ((booking.status ?? 'confirmed') !== 'confirmed') {
			return fail(400, { message: 'Only confirmed bookings can be cancelled from this screen.' });
		}

		const timestamp = new Date().toISOString();

		const { error: updateBookingError } = await locals.supabase
			.from('bookings')
			.update({
				status: 'cancelled',
				cancelled_at: timestamp,
				cancel_reason: cancelReason || 'Cancelled from the admin panel',
				updated_at: timestamp
			})
			.eq('id', bookingId);

		if (updateBookingError) {
			return fail(500, { message: updateBookingError.message });
		}

		const { error: updateSlotError } = await locals.supabase
			.from('available_slots')
			.update({ status: 'cancelled' })
			.eq('id', booking.slot_id);

		if (updateSlotError) {
			return fail(500, { message: updateSlotError.message });
		}

		return {
			success: true,
			message: 'Booking cancelled and the linked slot marked cancelled.'
		};
	}
};
