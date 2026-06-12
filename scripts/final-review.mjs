import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
	const values = {};

	if (!existsSync(path)) {
		return values;
	}

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
			throw new Error(`Could not load the seeded profile: ${error.message}`);
		}

		if (data) {
			return data;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error('The seeded auth user did not produce a profile row in time.');
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

async function createConfirmedUser(supabase, email, password, displayName) {
	const existing = await findAuthUserByEmail(supabase, email);

	if (existing) {
		const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id);

		if (deleteError) {
			throw new Error(`Could not delete the existing auth user ${email}: ${deleteError.message}`);
		}
	}

	const created = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			display_name: displayName
		}
	});

	if (created.error || !created.data.user) {
		throw new Error(
			`Could not create the auth user ${email}: ${created.error?.message ?? 'Unknown error'}`
		);
	}

	return created.data.user;
}

function buildStorageCookie(session, storageKey) {
	const encoded = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
	return `${storageKey}=base64-${encoded}`;
}

async function signInForCookie(projectUrl, anonKey, email, password, storageKey) {
	const client = createClient(projectUrl, anonKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const { data, error } = await client.auth.signInWithPassword({
		email,
		password
	});

	if (error || !data.session) {
		throw new Error(`Could not sign in ${email}: ${error?.message ?? 'Unknown error'}`);
	}

	return {
		session: data.session,
		cookie: buildStorageCookie(data.session, storageKey)
	};
}

async function assertRoute({ url, cookie, expectStatus = 200, expectRedirect, includes = [] }) {
	const response = await fetch(url, {
		headers: cookie ? { cookie } : undefined,
		redirect: 'manual'
	});

	const body = await response.text();

	if (response.status !== expectStatus) {
		throw new Error(`Expected ${url} to return ${expectStatus}, got ${response.status}.`);
	}

	if (expectRedirect) {
		const location = response.headers.get('location');

		if (location !== expectRedirect) {
			throw new Error(`Expected ${url} to redirect to ${expectRedirect}, got ${location ?? 'null'}.`);
		}
	}

	for (const snippet of includes) {
		if (!body.includes(snippet)) {
			throw new Error(`Expected ${url} to include "${snippet}".`);
		}
	}

	return {
		url,
		status: response.status,
		redirect: response.headers.get('location')
	};
}

async function submitAction({ url, cookie, form, expectStatus = 200, expectBodyIncludes = [] }) {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			cookie,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams(form),
		redirect: 'manual'
	});

	const body = await response.text();

	if (response.status !== expectStatus) {
		throw new Error(`Expected action ${url} to return ${expectStatus}, got ${response.status}.`);
	}

	for (const snippet of expectBodyIncludes) {
		if (!body.includes(snippet)) {
			throw new Error(`Expected action ${url} response to include "${snippet}".`);
		}
	}

	return {
		url,
		status: response.status
	};
}

async function cleanupByTag(supabase, tag) {
	const adminEmail = `${tag}-admin@example.com`;
	const guideEmail = `${tag}-guide@example.com`;
	const memberEmail = `${tag}-member@example.com`;
	const stripePrefix = `${tag}-`;

	const { data: bookings, error: bookingError } = await supabase
		.from('bookings')
		.select('id, slot_id, stripe_payment_intent_id')
		.like('stripe_payment_intent_id', `${stripePrefix}%`);

	if (bookingError) {
		throw new Error(`Could not load final review bookings: ${bookingError.message}`);
	}

	const slotIds = [...new Set((bookings ?? []).map((booking) => booking.slot_id))];

	if ((bookings ?? []).length > 0) {
		const { error } = await supabase
			.from('bookings')
			.delete()
			.like('stripe_payment_intent_id', `${stripePrefix}%`);

		if (error) {
			throw new Error(`Could not delete final review bookings: ${error.message}`);
		}
	}

	if (slotIds.length > 0) {
		const { error } = await supabase.from('available_slots').delete().in('id', slotIds);

		if (error) {
			throw new Error(`Could not delete final review slots: ${error.message}`);
		}
	}

	for (const email of [memberEmail, guideEmail, adminEmail]) {
		const user = await findAuthUserByEmail(supabase, email);

		if (!user) {
			continue;
		}

		await Promise.all([
			supabase.from('onboarding_responses').delete().eq('user_id', user.id),
			supabase.from('preferences').delete().eq('user_id', user.id),
			supabase.from('guide_profiles').delete().eq('id', user.id),
			supabase.from('profiles').delete().eq('id', user.id),
			supabase.from('invites').delete().eq('email', email)
		]);

		const { error } = await supabase.auth.admin.deleteUser(user.id);

		if (error) {
			throw new Error(`Could not delete final review auth user ${email}: ${error.message}`);
		}
	}

	return {
		tag,
		deletedBookings: bookings?.length ?? 0,
		deletedSlots: slotIds.length
	};
}

async function seedFinalReviewData(supabase, tag) {
	await cleanupByTag(supabase, tag);

	const adminEmail = `${tag}-admin@example.com`;
	const guideEmail = `${tag}-guide@example.com`;
	const memberEmail = `${tag}-member@example.com`;
	const adminPassword = 'FinalReviewAdmin123!';
	const guidePassword = 'FinalReviewGuide123!';
	const memberPassword = 'FinalReviewMember123!';

	const adminUser = await createConfirmedUser(supabase, adminEmail, adminPassword, 'Final Review Admin');
	const guideUser = await createConfirmedUser(supabase, guideEmail, guidePassword, 'Final Review Guide');
	const memberUser = await createConfirmedUser(
		supabase,
		memberEmail,
		memberPassword,
		'Final Review Member'
	);

	const [adminProfile, guideProfileBase, memberProfileBase] = await Promise.all([
		waitForProfile(supabase, adminUser.id),
		waitForProfile(supabase, guideUser.id),
		waitForProfile(supabase, memberUser.id)
	]);

	const timestamp = new Date().toISOString();

	const [adminProfileUpdate, guideProfileUpdate, memberProfileUpdate] = await Promise.all([
		supabase
			.from('profiles')
			.update({
				display_name: 'Final Review Admin',
				role: 'admin',
				suspended: false,
				updated_at: timestamp
			})
			.eq('id', adminProfile.id),
		supabase
			.from('profiles')
			.update({
				display_name: 'Final Review Guide',
				role: 'guide',
				suspended: false,
				updated_at: timestamp
			})
			.eq('id', guideProfileBase.id),
		supabase
			.from('profiles')
			.update({
				display_name: 'Final Review Member',
				role: 'member',
				suspended: false,
				onboarding_complete: true,
				user_state: 'onboarding_complete',
				updated_at: timestamp
			})
			.eq('id', memberProfileBase.id)
	]);

	for (const result of [adminProfileUpdate, guideProfileUpdate, memberProfileUpdate]) {
		if (result.error) {
			throw new Error(`Could not update a final review profile: ${result.error.message}`);
		}
	}

	const { error: guideProfileError } = await supabase.from('guide_profiles').insert({
		id: guideUser.id,
		user_id: guideUser.id,
		email: guideEmail,
		display_name: 'Final Review Guide',
		name: 'Final Review Guide',
		title: 'Community Guide',
		initials: 'FG',
		is_active: true,
		created_by: adminUser.id
	});

	if (guideProfileError) {
		throw new Error(`Could not create the final review guide profile: ${guideProfileError.message}`);
	}

	const onboardingPayload = {
		user_id: memberUser.id,
		relationship_goal: 'friendship_first',
		spouse_qualities: ['Patience', 'Faithfulness'],
		communication_style: 'calm_reflective',
		conflict_style: 'calm_discussion',
		lifestyle_vision: 'faith_family',
		shared_activities: ['Bible study', 'Volunteering'],
		shared_faith: 'essential',
		church_involvement: 'weekly_active',
		faith_role: 'Prayer and accountability',
		future_hopes: 'Build a peaceful Christ-centered home.',
		authentic_meaning: 'Living truthfully with spiritual depth.'
	};

	const preferencesPayload = {
		user_id: memberUser.id,
		age_min: 27,
		age_max: 36,
		distance_min: 5,
		distance_max: 60,
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
		supabase.from('onboarding_responses').insert(onboardingPayload),
		supabase.from('preferences').insert(preferencesPayload)
	]);

	if (onboardingInsert.error) {
		throw new Error(`Could not insert final review onboarding: ${onboardingInsert.error.message}`);
	}

	if (preferencesInsert.error) {
		throw new Error(`Could not insert final review preferences: ${preferencesInsert.error.message}`);
	}

	const completeSchedule = buildSchedule(7, 9, 0);
	const cancelSchedule = buildSchedule(8, 10, 30);

	const { data: slots, error: slotsError } = await supabase
		.from('available_slots')
		.insert([
			{
				guide_id: guideUser.id,
				slot_date: completeSchedule.slotDate,
				slot_time: completeSchedule.slotTime,
				starts_at: completeSchedule.startsAt,
				duration_minutes: 60,
				status: 'booked',
				booked_by: memberUser.id,
				booked_at: timestamp,
				created_by: adminUser.id
			},
			{
				guide_id: guideUser.id,
				slot_date: cancelSchedule.slotDate,
				slot_time: cancelSchedule.slotTime,
				starts_at: cancelSchedule.startsAt,
				duration_minutes: 45,
				status: 'booked',
				booked_by: memberUser.id,
				booked_at: timestamp,
				created_by: adminUser.id
			}
		])
		.select('id, starts_at')
		.order('starts_at', { ascending: true });

	if (slotsError || !slots || slots.length !== 2) {
		throw new Error(`Could not insert final review slots: ${slotsError?.message ?? 'Unknown error'}`);
	}

	const { data: bookings, error: bookingsError } = await supabase
		.from('bookings')
		.insert([
			{
				user_id: memberUser.id,
				guide_id: guideUser.id,
				slot_id: slots[0].id,
				slot_date: completeSchedule.slotDate,
				slot_time: completeSchedule.slotTime,
				duration_minutes: 60,
				status: 'confirmed',
				payment_status: 'pending',
				stripe_payment_intent_id: `${tag}-guide-complete`,
				amount_paid: 0,
				currency: 'usd'
			},
			{
				user_id: memberUser.id,
				guide_id: guideUser.id,
				slot_id: slots[1].id,
				slot_date: cancelSchedule.slotDate,
				slot_time: cancelSchedule.slotTime,
				duration_minutes: 45,
				status: 'confirmed',
				payment_status: 'paid',
				stripe_payment_intent_id: `${tag}-admin-cancel`,
				amount_paid: 125,
				currency: 'usd'
			}
		])
		.select('id, slot_id, stripe_payment_intent_id')
		.order('stripe_payment_intent_id', { ascending: true });

	if (bookingsError || !bookings || bookings.length !== 2) {
		throw new Error(
			`Could not insert final review bookings: ${bookingsError?.message ?? 'Unknown error'}`
		);
	}

	const { data: unrelatedMember } = await supabase
		.from('profiles')
		.select('id')
		.eq('role', 'member')
		.neq('id', memberUser.id)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	return {
		tag,
		admin: {
			id: adminUser.id,
			email: adminEmail,
			password: adminPassword
		},
		guide: {
			id: guideUser.id,
			email: guideEmail,
			password: guidePassword
		},
		member: {
			id: memberUser.id,
			email: memberEmail,
			password: memberPassword
		},
		bookings: {
			guideCompleteBookingId: bookings.find((booking) =>
				booking.stripe_payment_intent_id?.endsWith('guide-complete')
			)?.id,
			adminCancelBookingId: bookings.find((booking) =>
				booking.stripe_payment_intent_id?.endsWith('admin-cancel')
			)?.id
		},
		unrelatedMemberId: unrelatedMember?.id ?? null
	};
}

async function runFinalReview({
	projectUrl,
	anonKey,
	serviceRoleKey,
	tag,
	appUrl
}) {
	const adminSupabase = createClient(projectUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const storageKey = createClient(projectUrl, anonKey).auth['storageKey'];
	const seeded = await seedFinalReviewData(adminSupabase, tag);
	const adminAuth = await signInForCookie(
		projectUrl,
		anonKey,
		seeded.admin.email,
		seeded.admin.password,
		storageKey
	);
	const guideAuth = await signInForCookie(
		projectUrl,
		anonKey,
		seeded.guide.email,
		seeded.guide.password,
		storageKey
	);

	const adminRoutes = [];
	const guideRoutes = [];
	const actionChecks = [];

	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/`,
			cookie: adminAuth.cookie,
			includes: ['Authentic Admin', 'The dashboard is now powered by live Supabase data.']
		})
	);
	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/guides`,
			cookie: adminAuth.cookie,
			includes: ['Guides', 'Final Review Guide']
		})
	);
	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/slots`,
			cookie: adminAuth.cookie,
			includes: ['Slots', 'Publish slots']
		})
	);
	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/bookings?booking=${seeded.bookings.adminCancelBookingId}`,
			cookie: adminAuth.cookie,
			includes: ['Bookings', 'Booking detail', 'Final Review Member', 'Cancel Booking']
		})
	);
	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/members/${seeded.member.id}`,
			cookie: adminAuth.cookie,
			includes: ['Member Detail', 'Final Review Member', 'Suspend member access', 'Promote to moderator']
		})
	);
	adminRoutes.push(
		await assertRoute({
			url: `${appUrl}/team`,
			cookie: adminAuth.cookie,
			includes: ['Team Management', 'Final Review Admin', 'Final Review Guide']
		})
	);

	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/`,
			cookie: guideAuth.cookie,
			includes: ['Authentic Admin', 'Your dashboard is live with scoped data.']
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/slots`,
			cookie: guideAuth.cookie,
			includes: ['Slots', 'Guide accounts are read-only here and only show their own availability.']
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/bookings?booking=${seeded.bookings.guideCompleteBookingId}`,
			cookie: guideAuth.cookie,
			includes: ['Bookings', 'Booking detail', 'Mark Complete', 'Guide accounts can mark sessions complete, but cancellations stay with staff.']
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/members`,
			cookie: guideAuth.cookie,
			includes: ['Members', 'Guide accounts only see members connected to their own bookings.', 'Final Review Member']
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/members/${seeded.member.id}`,
			cookie: guideAuth.cookie,
			includes: ['Member Detail', 'Final Review Member']
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/guides`,
			cookie: guideAuth.cookie,
			expectStatus: 303,
			expectRedirect: '/'
		})
	);
	guideRoutes.push(
		await assertRoute({
			url: `${appUrl}/team`,
			cookie: guideAuth.cookie,
			expectStatus: 303,
			expectRedirect: '/'
		})
	);

	if (seeded.unrelatedMemberId) {
		guideRoutes.push(
			await assertRoute({
				url: `${appUrl}/members/${seeded.unrelatedMemberId}`,
				cookie: guideAuth.cookie,
				expectStatus: 404,
				includes: ['Member not found.']
			})
		);
	}

	actionChecks.push(
		await submitAction({
			url: `${appUrl}/bookings?/markComplete`,
			cookie: guideAuth.cookie,
			form: {
				bookingId: seeded.bookings.guideCompleteBookingId
			},
			expectBodyIncludes: ['Booking marked complete and the linked slot moved to completed.']
		})
	);

	actionChecks.push(
		await submitAction({
			url: `${appUrl}/bookings?/cancelBooking`,
			cookie: guideAuth.cookie,
			form: {
				bookingId: seeded.bookings.adminCancelBookingId,
				cancelReason: 'Guide should not be allowed to cancel.'
			},
			expectStatus: 200,
			expectBodyIncludes: ['Only admins and moderators can cancel bookings.']
		})
	);

	actionChecks.push(
		await submitAction({
			url: `${appUrl}/bookings?/cancelBooking`,
			cookie: adminAuth.cookie,
			form: {
				bookingId: seeded.bookings.adminCancelBookingId,
				cancelReason: 'Final review cancellation check'
			},
			expectBodyIncludes: ['Booking cancelled and the linked slot marked cancelled.']
		})
	);

	actionChecks.push(
		await submitAction({
			url: `${appUrl}/members/${seeded.member.id}?/suspend`,
			cookie: adminAuth.cookie,
			form: {
				memberId: seeded.member.id,
				nextSuspended: 'true'
			},
			expectBodyIncludes: ['Member access has been suspended.']
		})
	);

	actionChecks.push(
		await submitAction({
			url: `${appUrl}/members/${seeded.member.id}?/suspend`,
			cookie: adminAuth.cookie,
			form: {
				memberId: seeded.member.id,
				nextSuspended: 'false'
			},
			expectBodyIncludes: ['Member access has been restored.']
		})
	);

	const [completeBooking, cancelledBooking, memberProfile, completeSlot, cancelSlot, guideScopedBookings] =
		await Promise.all([
			adminSupabase
				.from('bookings')
				.select('status')
				.eq('id', seeded.bookings.guideCompleteBookingId)
				.maybeSingle(),
			adminSupabase
				.from('bookings')
				.select('status, cancel_reason')
				.eq('id', seeded.bookings.adminCancelBookingId)
				.maybeSingle(),
			adminSupabase
				.from('profiles')
				.select('role, suspended')
				.eq('id', seeded.member.id)
				.maybeSingle(),
			adminSupabase
				.from('available_slots')
				.select('status')
				.eq('id', (
					await adminSupabase
						.from('bookings')
						.select('slot_id')
						.eq('id', seeded.bookings.guideCompleteBookingId)
						.maybeSingle()
				).data?.slot_id ?? '')
				.maybeSingle(),
			adminSupabase
				.from('available_slots')
				.select('status')
				.eq('id', (
					await adminSupabase
						.from('bookings')
						.select('slot_id')
						.eq('id', seeded.bookings.adminCancelBookingId)
						.maybeSingle()
				).data?.slot_id ?? '')
				.maybeSingle(),
			createClient(projectUrl, anonKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				},
				global: {
					headers: {
						Authorization: `Bearer ${guideAuth.session.access_token}`
					}
				}
			})
				.from('bookings')
				.select('id, guide_id, user_id, status')
		]);

	if (completeBooking.error || completeBooking.data?.status !== 'completed') {
		throw new Error('Guide completion did not persist the booking status.');
	}

	if (cancelledBooking.error || cancelledBooking.data?.status !== 'cancelled') {
		throw new Error('Admin cancellation did not persist the booking status.');
	}

	if (
		cancelledBooking.data?.cancel_reason !== 'Final review cancellation check'
	) {
		throw new Error('Admin cancellation did not persist the cancellation reason.');
	}

	if (memberProfile.error || memberProfile.data?.role !== 'member' || memberProfile.data?.suspended !== false) {
		throw new Error('Member suspend/restore did not return the profile to the expected state.');
	}

	if (completeSlot.error || completeSlot.data?.status !== 'completed') {
		throw new Error('Guide completion did not persist the slot status.');
	}

	if (cancelSlot.error || cancelSlot.data?.status !== 'cancelled') {
		throw new Error('Admin cancellation did not persist the slot status.');
	}

	if (guideScopedBookings.error) {
		throw new Error(`Guide RLS booking query failed: ${guideScopedBookings.error.message}`);
	}

	const visibleGuideBookings = guideScopedBookings.data ?? [];

	if (
		visibleGuideBookings.some((booking) => booking.guide_id !== seeded.guide.id) ||
		!visibleGuideBookings.some((booking) => booking.id === seeded.bookings.guideCompleteBookingId) ||
		!visibleGuideBookings.some((booking) => booking.id === seeded.bookings.adminCancelBookingId)
	) {
		throw new Error('Guide RLS booking scope did not match the seeded guide-owned bookings.');
	}

	const cleanup = await cleanupByTag(adminSupabase, tag);

	return {
		tag,
		adminRoutes,
		guideRoutes,
		actionChecks,
		rls: {
			guideVisibleBookingIds: visibleGuideBookings.map((booking) => booking.id)
		},
		cleanup
	};
}

const baseEnv = existsSync('.env') ? loadEnvFile('.env') : {};
const localEnv = existsSync('.env.local') ? loadEnvFile('.env.local') : {};
const fileEnv = { ...baseEnv, ...localEnv };

const mode = process.argv[2] ?? 'run';
const tag = getArgValue('--tag') ?? `finalreview-${Date.now()}`;
const appUrl = getArgValue('--app-url') ?? 'http://127.0.0.1:4174';
const projectUrl =
	process.env.PUBLIC_SUPABASE_URL ??
	process.env.EXPO_PUBLIC_SUPABASE_URL ??
	fileEnv.PUBLIC_SUPABASE_URL ??
	fileEnv.EXPO_PUBLIC_SUPABASE_URL;
const anonKey =
	process.env.PUBLIC_SUPABASE_ANON_KEY ??
	process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
	fileEnv.PUBLIC_SUPABASE_ANON_KEY ??
	fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ??
	process.env.SUPABASE_SECRET_KEY ??
	fileEnv.SUPABASE_SERVICE_ROLE_KEY ??
	fileEnv.SUPABASE_SECRET_KEY;

if (!projectUrl) {
	console.error('PUBLIC_SUPABASE_URL is required.');
	process.exit(1);
}

if (!anonKey) {
	console.error('PUBLIC_SUPABASE_ANON_KEY is required.');
	process.exit(1);
}

if (!serviceRoleKey) {
	console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
	process.exit(1);
}

const supabase = createClient(projectUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

try {
	if (mode === 'run') {
		const result = await runFinalReview({
			projectUrl,
			anonKey,
			serviceRoleKey,
			tag,
			appUrl
		});
		console.log(JSON.stringify(result, null, 2));
	} else if (mode === 'cleanup') {
		const result = await cleanupByTag(supabase, tag);
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.error(`Unknown mode "${mode}". Use "run" or "cleanup".`);
		process.exit(1);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	try {
		await cleanupByTag(supabase, tag);
	} catch {
		// Cleanup is best-effort after a failed final review run.
	}
	process.exit(1);
}
