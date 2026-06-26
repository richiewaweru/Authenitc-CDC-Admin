<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	import { getSupabaseBrowserClient } from '$lib/supabase';

	type RealtimeState = 'idle' | 'connecting' | 'connected' | 'refreshing' | 'error';

	let { data } = $props();

	let realtimeState = $state<RealtimeState>('idle');
	let realtimeMessage = $state('Watching for booking updates');

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

	function activityToneClass(tone: (typeof data.recentActivity)[number]['tone']) {
		switch (tone) {
			case 'success':
				return 'bg-success text-primary-dark';
			case 'warning':
				return 'bg-warning/55 text-[#664D03]';
			default:
				return 'bg-[#DCE8FF] text-[#214D9C]';
		}
	}

	onMount(() => {
		const supabase = getSupabaseBrowserClient();
		realtimeState = 'connecting';
		realtimeMessage = 'Connecting to realtime updates';

		const channel = supabase
			.channel('dashboard-bookings')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
				realtimeState = 'refreshing';
				realtimeMessage = 'Booking update received. Refreshing dashboard...';
				void invalidateAll().finally(() => {
					realtimeState = 'connected';
					realtimeMessage = 'Realtime updates connected';
				});
			})
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
			<p class="section-eyebrow">Dashboard</p>
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
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<div class="rounded-2xl border border-sand bg-surface p-6">
			<p class="text-sm font-medium text-on-surface-variant">Total Members</p>
			<p class="mt-1 text-3xl font-bold text-primary-dark">{data.stats.totalMembers}</p>
		</div>
		<div class="rounded-2xl border border-sand bg-surface p-6">
			<p class="text-sm font-medium text-on-surface-variant">Active Bookings</p>
			<p class="mt-1 text-3xl font-bold text-primary-dark">{data.stats.activeBookings}</p>
		</div>
		<div class="rounded-2xl border border-sand bg-surface p-6">
			<p class="text-sm font-medium text-on-surface-variant">Completed Conversations</p>
			<p class="mt-1 text-3xl font-bold text-primary-dark">{data.stats.completedConversations}</p>
		</div>
		<div class="rounded-2xl border border-sand bg-surface p-6">
			<p class="text-sm font-medium text-on-surface-variant">Pending Community Access</p>
			<p class="mt-1 text-3xl font-bold text-primary-dark">{data.stats.pendingCommunityAccess}</p>
		</div>
	</div>

	<div class="shell-card space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="section-eyebrow">Recent Activity</p>
				<h2 class="font-display text-2xl font-semibold">Latest staff notifications</h2>
			</div>
			<a href="/bookings" class="button-secondary w-full sm:w-auto">Open bookings</a>
		</div>

		{#if data.recentActivity.length > 0}
			<div class="space-y-3">
				{#each data.recentActivity as item}
					<a
						href={item.href}
						class="block rounded-[24px] border border-sand bg-background px-4 py-4 hover:border-primary/30 hover:bg-white"
					>
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0 space-y-1">
								<div class="flex items-center gap-2">
									<span class={`badge ${activityToneClass(item.tone)}`}>{item.kind}</span>
									<span class="text-xs text-on-surface-variant">
										{formatRelativeTime(item.createdAt)}
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
				No recent notifications yet.
			</div>
		{/if}
	</div>
</section>
