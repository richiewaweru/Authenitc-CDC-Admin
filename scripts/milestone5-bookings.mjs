import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
	const values = {};
	const raw = readFileSync(path, 'utf8');

	for (const line of raw.split(/\r?\n/)) {
		if (!line || line.trim().startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');
		if (separator === -1) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (key) {
			values[key] = value;
		}
	}

	return values;
}

function getArgValue(name) {
	const prefix = `${name}=`;
	const match = process.argv.find((arg) => arg.startsWith(prefix));
	return match ? match.slice(prefix.length) : null;
}

function formatDate(date) {
	return date.toISOString().slice(0, 10);
}

function formatTime(date) {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function buildSchedule(daysFromNow, hour, minute) {
	const date = new Date();
	date.setDate(date.getDate() + daysFromNow);
	date.setHours(hour, minute, 0, 0);

	return {
		slotDate: formatDate(date),
		slotTime: formatTime(date),
		startsAt: date.toISOString()
	};
}

async function lookupVerificationRecords(supabase) {
	const [{ data: member, error: memberError }, { data: guide, error: guideError }] = await Promise.all([
		supabase
			.from('profiles')
			.select('id, email, display_name, role')
			.eq('role', 'member')
			.order('created_at', { ascending: true })
			.limit(1)
			.maybeSingle(),
		supabase
			.from('guide_profiles')
			.select('id, email, display_name, name, title, is_active')
			.eq('is_active', true)
			.order('created_at', { ascending: true })
			.limit(1)
			.maybeSingle()
	]);

	if (memberError) {
		throw new Error(`Could not load a member profile: ${memberError.message}`);
	}

	if (guideError) {
		throw new Error(`Could not load a guide profile: ${guideError.message}`);
	}

	if (!member) {
		throw new Error('No member profile is available for Milestone 5 verification.');
	}

	if (!guide) {
		throw new Error('No active guide profile is available for Milestone 5 verification.');
	}

	return { member, guide };
}

async function cleanupByTag(supabase, tag) {
	const prefix = `${tag}-`;
	const { data: bookings, error: bookingLookupError } = await supabase
		.from('bookings')
		.select('id, slot_id, stripe_payment_intent_id')
		.like('stripe_payment_intent_id', `${prefix}%`);

	if (bookingLookupError) {
		throw new Error(`Could not look up seeded bookings: ${bookingLookupError.message}`);
	}

	const slotIds = [...new Set((bookings ?? []).map((booking) => booking.slot_id))];

	if ((bookings ?? []).length > 0) {
		const { error: bookingDeleteError } = await supabase
			.from('bookings')
			.delete()
			.like('stripe_payment_intent_id', `${prefix}%`);

		if (bookingDeleteError) {
			throw new Error(`Could not delete seeded bookings: ${bookingDeleteError.message}`);
		}
	}

	if (slotIds.length > 0) {
		const { error: slotDeleteError } = await supabase.from('available_slots').delete().in('id', slotIds);

		if (slotDeleteError) {
			throw new Error(`Could not delete seeded slots: ${slotDeleteError.message}`);
		}
	}

	return {
		tag,
		deletedBookings: bookings?.length ?? 0,
		deletedSlots: slotIds.length
	};
}

async function seedVerificationBookings(supabase, tag) {
	const { member, guide } = await lookupVerificationRecords(supabase);
	const completeSchedule = buildSchedule(14, 9, 10);
	const cancelSchedule = buildSchedule(15, 10, 40);
	const bookedAt = new Date().toISOString();
	const verificationIntents = [`${tag}-complete`, `${tag}-cancel`];

	const { data: existingBookings, error: existingBookingsError } = await supabase
		.from('bookings')
		.select('id, slot_id')
		.in('stripe_payment_intent_id', verificationIntents);

	if (existingBookingsError) {
		throw new Error(`Could not check existing verification bookings: ${existingBookingsError.message}`);
	}

	if ((existingBookings ?? []).length > 0) {
		const { error: deleteExistingBookingsError } = await supabase
			.from('bookings')
			.delete()
			.in(
				'id',
				existingBookings.map((booking) => booking.id)
			);

		if (deleteExistingBookingsError) {
			throw new Error(
				`Could not delete existing verification bookings: ${deleteExistingBookingsError.message}`
			);
		}
	}

	const { data: existingSlots, error: existingSlotsError } = await supabase
		.from('available_slots')
		.select('id')
		.eq('guide_id', guide.id)
		.in('starts_at', [completeSchedule.startsAt, cancelSchedule.startsAt]);

	if (existingSlotsError) {
		throw new Error(`Could not check existing verification slots: ${existingSlotsError.message}`);
	}

	if ((existingSlots ?? []).length > 0) {
		const { error: deleteExistingSlotsError } = await supabase
			.from('available_slots')
			.delete()
			.in(
				'id',
				existingSlots.map((slot) => slot.id)
			);

		if (deleteExistingSlotsError) {
			throw new Error(`Could not delete existing verification slots: ${deleteExistingSlotsError.message}`);
		}
	}

	const { data: completeSlot, error: completeSlotError } = await supabase
		.from('available_slots')
		.insert({
			guide_id: guide.id,
			slot_date: completeSchedule.slotDate,
			slot_time: completeSchedule.slotTime,
			starts_at: completeSchedule.startsAt,
			duration_minutes: 60,
			status: 'booked',
			booked_by: member.id,
			booked_at: bookedAt
		})
		.select('id, starts_at, slot_date, slot_time')
		.single();

	if (completeSlotError || !completeSlot) {
		throw new Error(
			`Could not insert the completion verification slot: ${completeSlotError?.message ?? 'Unknown error'}`
		);
	}

	const { data: cancelSlot, error: cancelSlotError } = await supabase
		.from('available_slots')
		.insert({
			guide_id: guide.id,
			slot_date: cancelSchedule.slotDate,
			slot_time: cancelSchedule.slotTime,
			starts_at: cancelSchedule.startsAt,
			duration_minutes: 45,
			status: 'booked',
			booked_by: member.id,
			booked_at: bookedAt
		})
		.select('id, starts_at, slot_date, slot_time')
		.single();

	if (cancelSlotError || !cancelSlot) {
		await supabase.from('available_slots').delete().eq('id', completeSlot.id);
		throw new Error(
			`Could not insert the cancellation verification slot: ${cancelSlotError?.message ?? 'Unknown error'}`
		);
	}

	const { data: bookings, error: bookingInsertError } = await supabase
		.from('bookings')
		.insert([
			{
				user_id: member.id,
				guide_id: guide.id,
				slot_id: completeSlot.id,
				slot_date: completeSchedule.slotDate,
				slot_time: completeSchedule.slotTime,
				duration_minutes: 60,
				status: 'confirmed',
				payment_status: 'pending',
				stripe_payment_intent_id: `${tag}-complete`,
				amount_paid: 0,
				currency: 'usd'
			},
			{
				user_id: member.id,
				guide_id: guide.id,
				slot_id: cancelSlot.id,
				slot_date: cancelSchedule.slotDate,
				slot_time: cancelSchedule.slotTime,
				duration_minutes: 45,
				status: 'confirmed',
				payment_status: 'paid',
				stripe_payment_intent_id: `${tag}-cancel`,
				amount_paid: 150,
				currency: 'usd'
			}
		])
		.select('id, slot_id, payment_status, stripe_payment_intent_id');

	if (bookingInsertError) {
		await supabase.from('available_slots').delete().in('id', [completeSlot.id, cancelSlot.id]);
		throw new Error(`Could not insert verification bookings: ${bookingInsertError.message}`);
	}

	return {
		tag,
		member,
		guide,
		bookings,
		nextSteps: [
			'Open /bookings as an admin or moderator.',
			'Use the pending payment booking for the Mark Complete action.',
			'Use the paid booking for the Cancel Booking action.',
			`Run \`node scripts/milestone5-bookings.mjs cleanup --tag=${tag}\` after verification.`
		]
	};
}

const baseEnv = existsSync('.env') ? loadEnvFile('.env') : {};
const localEnv = existsSync('.env.local') ? loadEnvFile('.env.local') : {};
const fileEnv = { ...baseEnv, ...localEnv };
const mode = process.argv[2] ?? 'seed';
const tag = getArgValue('--tag') ?? `milestone5-${Date.now()}`;
const projectUrl = process.env.PUBLIC_SUPABASE_URL ?? fileEnv.PUBLIC_SUPABASE_URL;
const serviceRoleKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ??
	process.env.SUPABASE_SECRET_KEY ??
	fileEnv.SUPABASE_SERVICE_ROLE_KEY ??
	fileEnv.SUPABASE_SECRET_KEY;

if (!projectUrl) {
	console.error('PUBLIC_SUPABASE_URL is required.');
	process.exit(1);
}

if (!serviceRoleKey) {
	console.error(
		'SUPABASE_SERVICE_ROLE_KEY is required to seed or clean verification bookings. Set it in your environment before running this script.'
	);
	process.exit(1);
}

const supabase = createClient(projectUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

try {
	if (mode === 'seed') {
		const result = await seedVerificationBookings(supabase, tag);
		console.log(JSON.stringify(result, null, 2));
	} else if (mode === 'cleanup') {
		const result = await cleanupByTag(supabase, tag);
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.error(`Unknown mode "${mode}". Use "seed" or "cleanup".`);
		process.exit(1);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
