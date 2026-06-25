<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
	import type { Snippet } from 'svelte';

	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NotificationPanel from '$lib/components/NotificationPanel.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';
	import { notificationStore, type AppNotification } from '$lib/stores/notifications';
	import { getSupabaseBrowserClient } from '$lib/supabase';
	import type { Database, SidebarItem, StaffRole, UserSummary } from '$lib/types';

	type Props = {
		role: StaffRole;
		user: UserSummary;
		navigation: SidebarItem[];
		children: Snippet;
	};

	type BookingNotificationRow = Pick<
		Database['public']['Tables']['bookings']['Row'],
		| 'id'
		| 'user_id'
		| 'guide_id'
		| 'status'
		| 'payment_status'
		| 'amount_paid'
		| 'currency'
		| 'created_at'
		| 'updated_at'
	>;

	type ProfileNotificationRow = Pick<
		Database['public']['Tables']['profiles']['Row'],
		| 'id'
		| 'email'
		| 'display_name'
		| 'role'
		| 'suspended'
		| 'onboarding_complete'
		| 'created_at'
		| 'updated_at'
	>;

	type StaffNotificationRow = Pick<
		Database['public']['Tables']['staff_notifications']['Row'],
		'id' | 'kind' | 'tone' | 'title' | 'detail' | 'href' | 'read' | 'created_at'
	>;

	let { role, user, navigation, children }: Props = $props();

	const mobileItems = $derived(navigation.filter((item) => item.label !== 'Settings').slice(0, 5));
	const pathname = $derived(page.url.pathname);
	let isSigningOut = $state(false);
	let isNotificationsOpen = $state(false);
	let notifications = $state<AppNotification[]>([]);
	let lastNotificationFeedAt = $state(new Date().toISOString());

	const unreadCount = $derived(notifications.filter((notification) => !notification.read).length);

	const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

	function getProfileLabel(profile?: { display_name?: string | null; email?: string | null } | null) {
		if (profile?.display_name?.trim()) {
			return profile.display_name.trim();
		}

		if (profile?.email) {
			return profile.email.split('@')[0];
		}

		return 'Unknown member';
	}

	function getGuideLabel(guide?: {
		display_name?: string | null;
		name?: string | null;
		email?: string | null;
	} | null) {
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

	function makeNotificationId(prefix: string, rowId: string, timestamp: string | null) {
		return `${prefix}:${rowId}:${timestamp ?? 'unknown'}`;
	}

	function asBookingNotificationRow(value: BookingNotificationRow | {}) {
		return value as BookingNotificationRow;
	}

	function asProfileNotificationRow(value: ProfileNotificationRow | {}) {
		return value as ProfileNotificationRow;
	}

	function toAppNotification(row: StaffNotificationRow) {
		return {
			id: row.id,
			kind: row.kind as AppNotification['kind'],
			tone: row.tone as AppNotification['tone'],
			title: row.title,
			detail: row.detail,
			href: row.href,
			createdAt: row.created_at,
			read: row.read
		} satisfies AppNotification;
	}

	async function fetchProfileSummary(id: string | null) {
		if (!id) {
			return null;
		}

		const supabase = getSupabaseBrowserClient();
		const { data } = await supabase
			.from('profiles')
			.select('id, email, display_name')
			.eq('id', id)
			.maybeSingle();

		return data;
	}

	async function fetchGuideSummary(id: string | null) {
		if (!id) {
			return null;
		}

		const supabase = getSupabaseBrowserClient();
		const { data } = await supabase
			.from('guide_profiles')
			.select('id, email, name, display_name')
			.eq('id', id)
			.maybeSingle();

		return data;
	}

	function formatMoney(amount: number | null, currency: string | null) {
		if (amount === null || amount === undefined) {
			return null;
		}

		const safeCurrency = currency?.toUpperCase() ?? 'USD';
		return `${amount} ${safeCurrency}`;
	}

	async function buildBookingInsertNotification(row: BookingNotificationRow) {
		const [member, guide] = await Promise.all([
			fetchProfileSummary(row.user_id),
			fetchGuideSummary(row.guide_id)
		]);

		return {
			id: makeNotificationId('booking-insert', row.id, row.created_at),
			kind: 'booking',
			tone: 'info',
			title: 'New booking',
			detail: `${getProfileLabel(member)} booked with ${getGuideLabel(guide)}.`,
			href: `/bookings?booking=${row.id}`,
			createdAt: row.created_at ?? new Date().toISOString(),
			read: false
		} satisfies AppNotification;
	}

	async function buildBookingUpdateNotification(
		nextRow: BookingNotificationRow,
		previousRow: BookingNotificationRow
	) {
		const paymentChanged = nextRow.payment_status !== previousRow.payment_status;
		const statusChanged = nextRow.status !== previousRow.status;

		if (!paymentChanged && !statusChanged) {
			return null;
		}

		const member = await fetchProfileSummary(nextRow.user_id);

		if (paymentChanged && nextRow.payment_status === 'paid') {
			return {
				id: makeNotificationId('booking-payment', nextRow.id, nextRow.updated_at),
				kind: 'payment',
				tone: 'success',
				title: 'Payment received',
				detail: `${getProfileLabel(member)} is now marked paid${formatMoney(nextRow.amount_paid, nextRow.currency) ? ` for ${formatMoney(nextRow.amount_paid, nextRow.currency)}` : ''}.`,
				href: `/bookings?booking=${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		if (paymentChanged && nextRow.payment_status === 'failed') {
			return {
				id: makeNotificationId('booking-payment-failed', nextRow.id, nextRow.updated_at),
				kind: 'payment',
				tone: 'warning',
				title: 'Payment failed',
				detail: `${getProfileLabel(member)} now has a failed payment status.`,
				href: `/bookings?booking=${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		if (statusChanged && nextRow.status === 'completed') {
			return {
				id: makeNotificationId('booking-completed', nextRow.id, nextRow.updated_at),
				kind: 'booking',
				tone: 'success',
				title: 'Booking completed',
				detail: `${getProfileLabel(member)} was marked complete.`,
				href: `/bookings?booking=${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		if (statusChanged && nextRow.status === 'cancelled') {
			return {
				id: makeNotificationId('booking-cancelled', nextRow.id, nextRow.updated_at),
				kind: 'booking',
				tone: 'warning',
				title: 'Booking cancelled',
				detail: `${getProfileLabel(member)} was moved into the cancelled state.`,
				href: `/bookings?booking=${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		return null;
	}

	function buildProfileUpdateNotification(
		nextRow: ProfileNotificationRow,
		previousRow: ProfileNotificationRow
	) {
		const memberLabel = getProfileLabel(nextRow);

		if (!previousRow.onboarding_complete && nextRow.onboarding_complete) {
			return {
				id: makeNotificationId('profile-onboarding', nextRow.id, nextRow.updated_at),
				kind: 'onboarding',
				tone: 'success',
				title: 'Onboarding ready',
				detail: `${memberLabel} completed onboarding and is ready for review.`,
				href: `/members/${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		if (previousRow.role !== nextRow.role) {
			return {
				id: makeNotificationId('profile-role', nextRow.id, nextRow.updated_at),
				kind: 'team',
				tone: 'info',
				title: 'Role updated',
				detail: `${memberLabel} is now assigned the ${nextRow.role} role.`,
				href: nextRow.role === 'moderator' || nextRow.role === 'admin' ? '/team' : `/members/${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		if (previousRow.suspended !== nextRow.suspended) {
			return {
				id: makeNotificationId('profile-suspension', nextRow.id, nextRow.updated_at),
				kind: 'team',
				tone: nextRow.suspended ? 'warning' : 'success',
				title: nextRow.suspended ? 'Member suspended' : 'Member restored',
				detail: nextRow.suspended
					? `${memberLabel} was suspended from access.`
					: `${memberLabel} was restored to normal access.`,
				href: `/members/${nextRow.id}`,
				createdAt: nextRow.updated_at ?? nextRow.created_at ?? new Date().toISOString(),
				read: false
			} satisfies AppNotification;
		}

		return null;
	}

	function toggleNotifications() {
		isNotificationsOpen = !isNotificationsOpen;
	}

	function closeNotifications() {
		isNotificationsOpen = false;
	}

	function markAllNotificationsRead() {
		notificationStore.markAllRead();

		void fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ all: true })
		});
	}

	async function handleNotificationSelect(notification: AppNotification) {
		notificationStore.markRead(notification.id);
		closeNotifications();

		void fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: [notification.id] })
		});

		await goto(notification.href, { invalidateAll: true });
	}

	async function loadPersistedNotifications() {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase
			.from('staff_notifications')
			.select('id, kind, tone, title, detail, href, read, created_at')
			.eq('recipient_id', user.id)
			.order('created_at', { ascending: false })
			.limit(30);

		if (error || !data) {
			return;
		}

		for (const row of data as StaffNotificationRow[]) {
			notificationStore.push(toAppNotification(row));
		}
	}

	async function pollNotificationFeed() {
		try {
			const response = await fetch(
				`/api/notifications?since=${encodeURIComponent(lastNotificationFeedAt)}`
			);

			if (!response.ok) {
				return;
			}

			const payload = (await response.json()) as { notifications?: AppNotification[] };
			const incoming = payload.notifications ?? [];

			for (const notification of incoming) {
				notificationStore.push(notification);
			}

			const latestTimestamp = incoming.at(-1)?.createdAt;
			if (latestTimestamp) {
				lastNotificationFeedAt = latestTimestamp;
			}
		} catch {
			// The realtime channel remains the primary path. This feed is a quiet fallback.
		}
	}

	async function signOut() {
		if (isSigningOut) {
			return;
		}

		isSigningOut = true;
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		await goto('/login', { invalidateAll: true, replaceState: true });
		isSigningOut = false;
	}

	onMount(() => {
		const unsubscribe = notificationStore.subscribe((value) => {
			notifications = value;
		});

		notificationStore.reset();
		lastNotificationFeedAt = new Date().toISOString();
		void loadPersistedNotifications();
		const supabase = getSupabaseBrowserClient();
		const channel = supabase
			.channel(`layout-notifications:${user.id}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'staff_notifications',
					filter: `recipient_id=eq.${user.id}`
				},
				(payload: RealtimePostgresChangesPayload<StaffNotificationRow>) => {
					notificationStore.push(toAppNotification(payload.new as StaffNotificationRow));
				}
			)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'bookings' },
				async (payload: RealtimePostgresChangesPayload<BookingNotificationRow>) => {
					const notification = await buildBookingInsertNotification(
						asBookingNotificationRow(payload.new)
					);
					notificationStore.push(notification);
				}
			)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'bookings' },
				async (payload: RealtimePostgresChangesPayload<BookingNotificationRow>) => {
					const notification = await buildBookingUpdateNotification(
						asBookingNotificationRow(payload.new),
						asBookingNotificationRow(payload.old)
					);

					if (notification) {
						notificationStore.push(notification);
					}
				}
			)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'profiles' },
				(payload: RealtimePostgresChangesPayload<ProfileNotificationRow>) => {
					const notification = buildProfileUpdateNotification(
						asProfileNotificationRow(payload.new),
						asProfileNotificationRow(payload.old)
					);

					if (notification) {
						notificationStore.push(notification);
					}
				}
			)
			.subscribe();
		const feedPoll = window.setInterval(() => {
			void pollNotificationFeed();
		}, 5000);

		return () => {
			window.clearInterval(feedPoll);
			unsubscribe();
			void supabase.removeChannel(channel);
		};
	});
</script>

<div class="min-h-screen pb-24 md:pb-0">
	<div class="mx-auto flex min-h-screen max-w-[1600px] gap-3 px-3 py-3 md:gap-4 md:px-4 lg:gap-6 lg:px-6">
		<aside class="hidden shrink-0 rounded-[28px] bg-primary-dark p-4 text-on-primary md:flex md:w-[88px] md:flex-col lg:w-[240px] lg:p-5">
			<div class="space-y-10">
				<div class="space-y-3 md:flex md:flex-col md:items-center lg:block">
					<div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 font-display text-2xl font-semibold">
						A
					</div>
					<div class="hidden lg:block">
						<p class="font-display text-2xl font-semibold">Authentic</p>
						<p class="text-sm text-white/70">Admin control panel</p>
					</div>
				</div>

				<nav class="space-y-2">
					{#each navigation.filter((item) => item.label !== 'Settings') as item}
						<a
							href={item.href}
							class={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium md:justify-center lg:justify-start ${
								isActive(item.href) ? 'bg-primary text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'
							}`}
							aria-label={item.label}
							title={item.label}
						>
							<Icon name={item.icon} className="h-5 w-5" />
							<span class="hidden lg:inline">{item.label}</span>
						</a>
					{/each}
				</nav>
			</div>

			<div class="mt-auto space-y-4">
				<a
					href="/settings"
					class={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium md:justify-center lg:justify-start ${
						isActive('/settings') ? 'bg-primary text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'
					}`}
					aria-label="Settings"
					title="Settings"
				>
					<Icon name="settings" className="h-5 w-5" />
					<span class="hidden lg:inline">Settings</span>
				</a>

				<div class="rounded-[24px] border border-white/12 bg-white/6 p-3">
					<div class="flex items-center gap-3">
						<Avatar initials={user.initials} name={user.displayName} size="md" />
						<div class="min-w-0 flex-1 md:hidden lg:block">
							<p class="truncate text-sm font-semibold text-white">{user.displayName}</p>
							<p class="truncate text-xs text-white/70">{user.email}</p>
						</div>
					</div>

					<div class="mt-4 flex items-center justify-between gap-3 md:flex-col lg:flex-row">
						<div class="rounded-full bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white md:text-center">
							{role}
						</div>
						<button
							type="button"
							class="inline-flex items-center gap-2 rounded-full border border-white/14 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white md:justify-center"
							onclick={signOut}
							aria-label="Sign out"
						>
							<Icon name="logout" className="h-3.5 w-3.5" />
							<span class="hidden lg:inline">{isSigningOut ? 'Signing out' : 'Sign out'}</span>
						</button>
					</div>
				</div>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<header class="sticky top-3 z-20 rounded-[24px] border border-sand/90 bg-surface/95 px-4 py-3 backdrop-blur lg:px-6">
				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sand bg-background text-on-surface"
						aria-label="Notifications"
						aria-expanded={isNotificationsOpen}
						aria-controls="notifications-panel-title"
						onclick={toggleNotifications}
					>
						<Icon name="bell" className="h-5 w-5" />
						{#if unreadCount > 0}
							<span class="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-white">
								{unreadCount > 9 ? '9+' : unreadCount}
							</span>
						{/if}
					</button>

					<div class="relative hidden min-w-[220px] flex-1 sm:block">
						<Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
						<input
							type="search"
							class="input-base pl-11"
							placeholder="Search guides, bookings, members..."
						/>
					</div>

					<div class="ml-auto flex items-center gap-3">
						<div class="sm:hidden">
							<Avatar initials={user.initials} name={user.displayName} size="sm" />
						</div>
						<div class="hidden items-center gap-3 rounded-2xl border border-sand bg-background px-3 py-2 sm:flex">
							<Avatar initials={user.initials} name={user.displayName} size="sm" />
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold text-on-surface">{user.displayName}</p>
								<p class="truncate text-xs text-on-surface-variant">{user.email}</p>
							</div>
						</div>
						<div class="hidden sm:block">
							<RoleBadge role={role} />
						</div>
					</div>
				</div>
			</header>

			<main class="min-w-0 flex-1 rounded-[28px] border border-sand/70 bg-white/45 px-4 py-5 md:rounded-[32px] md:px-6 md:py-6 lg:px-8 lg:py-8">
				{@render children()}
			</main>
		</div>
	</div>

	<nav class="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-sand bg-surface/95 p-2 shadow-lg backdrop-blur md:hidden">
		<div class="grid grid-cols-5 gap-1">
			{#each mobileItems as item}
				<a
					href={item.href}
					class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-semibold ${
						isActive(item.href) ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
					}`}
				>
					<Icon name={item.icon} className="h-4 w-4" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>

	<NotificationPanel
		open={isNotificationsOpen}
		notifications={notifications}
		unreadCount={unreadCount}
		onClose={closeNotifications}
		onMarkAllRead={markAllNotificationsRead}
		onSelect={handleNotificationSelect}
	/>
</div>
