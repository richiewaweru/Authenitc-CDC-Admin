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

async function waitForProfile(supabase, userId) {
	for (let attempt = 0; attempt < 12; attempt += 1) {
		const { data, error } = await supabase
			.from('profiles')
			.select(
				'id, email, display_name, avatar_url, role, suspended, onboarding_complete, user_state, last_sign_in_at, created_at, updated_at'
			)
			.eq('id', userId)
			.maybeSingle();

		if (error) {
			throw new Error(`Could not load the seeded member profile: ${error.message}`);
		}

		if (data) {
			return data;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error('The seeded auth user did not produce a profile row in time.');
}

async function lookupGuide(supabase, guideEmail) {
	const query = supabase
		.from('guide_profiles')
		.select(
			'id, user_id, email, name, display_name, title, avatar_url, initials, is_active, created_at, updated_at, created_by'
		)
		.eq('is_active', true)
		.not('user_id', 'is', null);

	const result = guideEmail
		? await query.eq('email', guideEmail).maybeSingle()
		: await query.order('created_at', { ascending: true }).limit(1).maybeSingle();

	if (result.error) {
		throw new Error(`Could not load a linked guide profile: ${result.error.message}`);
	}

	if (!result.data) {
		throw new Error('No linked active guide profile is available for Milestone 6 verification.');
	}

	return result.data;
}

async function findAuthUserByEmail(supabase, email) {
	let page = 1;

	while (true) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 200
		});

		if (error) {
			throw new Error(`Could not list auth users: ${error.message}`);
		}

		const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

		if (match) {
			return match;
		}

		if (data.users.length < 200) {
			return null;
		}

		page += 1;
	}
}

async function cleanupByTag(supabase, tag) {
	const email = `${tag}@example.com`;
	const user = await findAuthUserByEmail(supabase, email);
	const userId = user?.id ?? null;
	const prefix = `${tag}-`;

	const { data: bookings, error: bookingLookupError } = await supabase
		.from('bookings')
		.select('id, slot_id')
		.like('stripe_payment_intent_id', `${prefix}%`);

	if (bookingLookupError) {
		throw new Error(`Could not look up seeded member bookings: ${bookingLookupError.message}`);
	}

	const slotIds = [...new Set((bookings ?? []).map((booking) => booking.slot_id))];

	if ((bookings ?? []).length > 0) {
		const { error: deleteBookingsError } = await supabase
			.from('bookings')
			.delete()
			.like('stripe_payment_intent_id', `${prefix}%`);

		if (deleteBookingsError) {
			throw new Error(`Could not delete seeded member bookings: ${deleteBookingsError.message}`);
		}
	}

	if (slotIds.length > 0) {
		const { error: deleteSlotsError } = await supabase.from('available_slots').delete().in('id', slotIds);

		if (deleteSlotsError) {
			throw new Error(`Could not delete seeded member slots: ${deleteSlotsError.message}`);
		}
	}

	if (userId) {
		const [responseDelete, preferenceDelete, profileDelete] = await Promise.all([
			supabase.from('onboarding_responses').delete().eq('user_id', userId),
			supabase.from('preferences').delete().eq('user_id', userId),
			supabase.from('profiles').delete().eq('id', userId)
		]);

		if (responseDelete.error) {
			throw new Error(`Could not delete seeded onboarding responses: ${responseDelete.error.message}`);
		}

		if (preferenceDelete.error) {
			throw new Error(`Could not delete seeded preferences: ${preferenceDelete.error.message}`);
		}

		if (profileDelete.error) {
			throw new Error(`Could not delete seeded profile: ${profileDelete.error.message}`);
		}

		const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

		if (deleteUserError) {
			throw new Error(`Could not delete seeded auth user: ${deleteUserError.message}`);
		}
	}

	return {
		tag,
		email,
		deletedBookings: bookings?.length ?? 0,
		deletedSlots: slotIds.length,
		deletedAuthUser: Boolean(userId)
	};
}

async function seedVerificationMember(supabase, tag, guideEmail) {
	await cleanupByTag(supabase, tag);

	const guide = await lookupGuide(supabase, guideEmail);
	const email = `${tag}@example.com`;
	const password = 'Milestone6Pass123!';
	const createdUser = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			display_name: `Milestone 6 ${tag.slice(-6)}`
		}
	});

	if (createdUser.error || !createdUser.data.user) {
		throw new Error(
			`Could not create the verification auth user: ${createdUser.error?.message ?? 'Unknown error'}`
		);
	}

	const profile = await waitForProfile(supabase, createdUser.data.user.id);
	const memberLabel = profile.display_name ?? `Milestone 6 ${tag.slice(-6)}`;
	const schedule = buildSchedule(10, 11, 15);

	const { error: profileUpdateError } = await supabase
		.from('profiles')
		.update({
			display_name: memberLabel,
			role: 'member',
			suspended: false,
			onboarding_complete: true,
			user_state: 'onboarding_complete',
			updated_at: new Date().toISOString()
		})
		.eq('id', profile.id);

	if (profileUpdateError) {
		throw new Error(`Could not finalize the verification member profile: ${profileUpdateError.message}`);
	}

	const onboardingPayload = {
		user_id: profile.id,
		relationship_goal: 'friendship_first',
		spouse_qualities: ['Spiritual maturity', 'Consistency'],
		communication_style: 'calm_reflective',
		conflict_style: 'calm_discussion',
		lifestyle_vision: 'faith_family',
		shared_activities: ['Bible study', 'Hiking'],
		shared_faith: 'essential',
		church_involvement: 'weekly_active',
		faith_role: 'Prayer and accountability',
		future_hopes: 'Build a peaceful Christ-centered home.',
		authentic_meaning: 'Living truthfully with spiritual depth.'
	};

	const preferencesPayload = {
		user_id: profile.id,
		age_min: 26,
		age_max: 36,
		distance_min: 10,
		distance_max: 80,
		denominations: ['Non-denominational'],
		dealbreaker_smoking: 'Prefer no',
		dealbreaker_children: 'Open to kids',
		dealbreaker_politics: 'Prefer similar',
		dealbreaker_church: 'Prefer active',
		notify_new_alignments: true,
		notify_event_updates: true,
		notify_community_updates: false
	};

	const [onboardingInsert, preferencesInsert] = await Promise.all([
		supabase.from('onboarding_responses').insert(onboardingPayload).select('id').single(),
		supabase.from('preferences').insert(preferencesPayload).select('id').single()
	]);

	if (onboardingInsert.error) {
		throw new Error(`Could not insert verification onboarding: ${onboardingInsert.error.message}`);
	}

	if (preferencesInsert.error) {
		throw new Error(`Could not insert verification preferences: ${preferencesInsert.error.message}`);
	}

	const { data: slot, error: slotError } = await supabase
		.from('available_slots')
		.insert({
			guide_id: guide.id,
			slot_date: schedule.slotDate,
			slot_time: schedule.slotTime,
			starts_at: schedule.startsAt,
			duration_minutes: 60,
			status: 'booked',
			booked_by: profile.id,
			booked_at: new Date().toISOString()
		})
		.select('id')
		.single();

	if (slotError || !slot) {
		throw new Error(`Could not insert the verification slot: ${slotError?.message ?? 'Unknown error'}`);
	}

	const { data: booking, error: bookingError } = await supabase
		.from('bookings')
		.insert({
			user_id: profile.id,
			guide_id: guide.id,
			slot_id: slot.id,
			slot_date: schedule.slotDate,
			slot_time: schedule.slotTime,
			duration_minutes: 60,
			status: 'confirmed',
			payment_status: 'pending',
			stripe_payment_intent_id: `${tag}-scoped`,
			amount_paid: 0,
			currency: 'usd'
		})
		.select('id')
		.single();

	if (bookingError || !booking) {
		await supabase.from('available_slots').delete().eq('id', slot.id);
		throw new Error(`Could not insert the verification booking: ${bookingError?.message ?? 'Unknown error'}`);
	}

	return {
		tag,
		email,
		password,
		memberId: profile.id,
		bookingId: booking.id,
		guide: {
			id: guide.id,
			email: guide.email,
			label: guide.display_name ?? guide.name ?? guide.email ?? 'Guide'
		},
		nextSteps: [
			'Open /members as an admin and verify the disposable member card renders.',
			'Open the detail page to verify onboarding and preferences panels.',
			'Use the suspend/restore flow, then verify guide scoping against the seeded booking.',
			`Run \`node scripts/milestone6-members.mjs cleanup --tag=${tag}\` after verification.`
		]
	};
}

const baseEnv = existsSync('.env') ? loadEnvFile('.env') : {};
const localEnv = existsSync('.env.local') ? loadEnvFile('.env.local') : {};
const fileEnv = { ...baseEnv, ...localEnv };
const mode = process.argv[2] ?? 'seed';
const tag = getArgValue('--tag') ?? `milestone6-${Date.now()}`;
const guideEmail = getArgValue('--guide-email');
const projectUrl =
	process.env.PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? fileEnv.PUBLIC_SUPABASE_URL ?? fileEnv.EXPO_PUBLIC_SUPABASE_URL;
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
		'SUPABASE_SERVICE_ROLE_KEY is required to seed or clean verification members. Set it in your environment before running this script.'
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
		const result = await seedVerificationMember(supabase, tag, guideEmail);
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
