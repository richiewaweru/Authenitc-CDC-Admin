<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	import { getSupabaseBrowserClient } from '$lib/supabase';

	type RealtimeState = 'idle' | 'connecting' | 'connected' | 'refreshing' | 'error';

	let { data } = $props();

	let realtimeState = $state<RealtimeState>('idle');
	let realtimeMessage = $state('Watching for booking updates');

	function formatDateTime(value: string | null) {
		if (!value) {
			return 'Time unavailable';
		}

		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function formatRelativeTime(value: string | null) {
		if (!value) {
			return 'Unknown time';
		}

		const diffMs = new Date(value).getTime() - Date.now();
		const diffMinutes = Math.round(diffMs / 60000);
		const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

		if (Math.abs(diffMinutes) < 60) {
			return formatter.format(diffMinutes, 'minute');
		}

		const diffHours = Math.round(diffMinutes / 60);
		if (Math.abs(diffHours) < 24) {
			return formatter.format(diffHours, 'hour');
		}

		const diffDays = Math.round(diffHours / 24);
		return formatter.format(diffDays, 'day');
	}

	onMount(() => {
		const supabase = getSupabaseBrowserClient();
		realtimeState = 'connecting';
		realtimeMessage = 'Connecting to realtime updates';

		const channel = supabase
			.channel('dashboard-bookings')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'bookings' },
				() => {
					realtimeState = 'refreshing';
					realtimeMessage = 'Booking update received. Refreshing dashboard...';
					void invalidateAll().finally(() => {
						realtimeState = 'connected';
						realtimeMessage = 'Realtime updates connected';
					});
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					realtimeState = 'connected';
					realtimeMessage = 'Realtime updates connected';
					return;
				}

				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					realtimeState = 'error';
					realtimeMessage = 'Realtime could not connect';
				}
			});

		return () => {
			void supabase.removeChannel(channel);
		};
	});
</script>

<section class="space-y-8">
	<div class="space-y-3">
		<div class="flex flex-wrap items-center gap-3">
			<p class="section-eyebrow">Milestone 2 In Progress</p>
			<span
				class={`badge ${
					realtimeState === 'connected'
						? 'bg-success text-primary-dark'
						: realtimeState === 'error'
							? 'bg-error text-error-strong'
							: 'bg-background text-on-surface-variant'
				}`}
			>
				Realtime {realtimeState}
			</span>
		</div>
		<h1 class="panel-title">
			{data.role === 'guide'
				? 'Your dashboard is live with scoped data.'
				: 'The dashboard is now powered by live Supabase data.'}
		</h1>
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">{realtimeMessage}</p>
	</div>

	{#if data.role === 'admin'}
		<a href="/team" class="shell-card block space-y-3 md:hidden hover:-translate-y-0.5">
			<p class="section-eyebrow">Mobile Shortcut</p>
			<h2 class="font-display text-2xl font-semibold text-on-surface">Manage Team</h2>
			<p class="text-sm leading-7 text-on-surface-variant">
				Open admin-only team controls from Home when the bottom tab bar is already using all five slots.
			</p>
		</a>
	{/if}

	{#if data.issues.length > 0}
		<div class="card space-y-4 border-red-200 bg-error/45 p-5">
			<div class="space-y-1">
				<p class="section-eyebrow text-error-strong">Dashboard Query Issues</p>
				<h2 class="font-display text-2xl font-semibold text-error-strong">
					Some dashboard panels could not fully load.
				</h2>
			</div>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>
						<span class="font-semibold">{issue.source}:</span>
						<span>{issue.message}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		{#each data.cards as card}
			<a href={card.href} class="shell-card block space-y-4 hover:-translate-y-0.5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="section-eyebrow">{card.label}</p>
						<p class="mt-4 font-display text-3xl font-semibold text-on-surface">{card.value}</p>
					</div>
					<span class="badge bg-background text-on-surface-variant">Live</span>
				</div>
				<p class="text-sm text-on-surface-variant">{card.note}</p>
			</a>
		{/each}
	</div>

	<div class="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
		<div class="shell-card space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="section-eyebrow">Recent Activity</p>
					<h2 class="font-display text-2xl font-semibold">Latest bookings and completions</h2>
				</div>
				<a href="/bookings" class="button-secondary w-full sm:w-auto">Open bookings</a>
			</div>

			{#if data.activityItems.length > 0}
				<div class="space-y-3">
					{#each data.activityItems as item}
						<a
							href={item.href}
							class="block rounded-[24px] border border-sand bg-background px-4 py-4 hover:border-primary/30 hover:bg-white"
						>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div class="min-w-0 space-y-1">
									<div class="flex items-center gap-2">
										<span
											class={`badge ${
												item.type === 'booking'
													? 'bg-warning/55 text-[#664D03]'
													: 'bg-success text-primary-dark'
											}`}
										>
											{item.type === 'booking' ? 'Booking' : 'Onboarding'}
										</span>
										<span class="text-xs text-on-surface-variant">
											{formatRelativeTime(item.timestamp)}
										</span>
									</div>
									<p class="text-sm font-semibold text-on-surface">{item.title}</p>
									<p class="text-sm text-on-surface-variant">{item.detail}</p>
								</div>
								<span class="text-sm font-semibold text-primary">View -></span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
					No recent booking or onboarding activity has appeared yet.
				</div>
			{/if}
		</div>

		<div class="shell-card space-y-4">
			<div>
				<p class="section-eyebrow">Upcoming</p>
				<h2 class="font-display text-2xl font-semibold">Next 48 hours</h2>
			</div>

			{#if data.upcomingItems.length > 0}
				<div class="space-y-3">
					{#each data.upcomingItems as item}
						<a
							href={item.href}
							class="block rounded-[24px] border border-sand bg-background px-4 py-4 hover:border-primary/30 hover:bg-white"
						>
							<p class="text-sm font-semibold text-on-surface">{formatDateTime(item.startsAt)}</p>
							<p class="mt-2 text-sm text-on-surface-variant">
								<span class="font-medium text-on-surface">{item.guideName}</span>
								<span> to </span>
								<span class="font-medium text-on-surface">{item.memberName}</span>
							</p>
							<div class="mt-3 flex flex-wrap items-center gap-2">
								<span class="badge bg-info text-info-strong">{item.status}</span>
								{#if item.paymentStatus}
									<span class="badge bg-warning/55 text-[#664D03]">{item.paymentStatus}</span>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
					There are no booked slots in the next 48 hours yet.
				</div>
			{/if}
		</div>
	</div>

	<div class="shell-card space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="section-eyebrow">Needs Attention</p>
				<h2 class="font-display text-2xl font-semibold">Items that need staff follow-up</h2>
			</div>
				<a href="/members" class="button-secondary w-full sm:w-auto">Open members</a>
		</div>

		{#if data.attentionItems.length > 0}
			<div class="grid gap-3 lg:grid-cols-2">
				{#each data.attentionItems as item}
					<a
						href={item.href}
						class="block rounded-[24px] border border-sand bg-background px-4 py-4 hover:border-primary/30 hover:bg-white"
					>
						<div class="flex items-center gap-2">
							<span
								class={`badge ${
									item.type === 'payment'
										? 'bg-warning/55 text-[#664D03]'
										: 'bg-info text-info-strong'
								}`}
							>
								{item.type === 'payment' ? 'Payment' : 'Review'}
							</span>
							<span class="text-xs text-on-surface-variant">
								{formatRelativeTime(item.timestamp)}
							</span>
						</div>
						<p class="mt-3 text-sm font-semibold text-on-surface">{item.title}</p>
						<p class="mt-1 text-sm text-on-surface-variant">{item.detail}</p>
					</a>
				{/each}
			</div>
		{:else}
			<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
				Nothing needs urgent staff follow-up right now.
			</div>
		{/if}
	</div>
</section>
