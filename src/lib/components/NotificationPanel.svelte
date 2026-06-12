<script lang="ts">
	import type { AppNotification } from '$lib/stores/notifications';

	type Props = {
		open: boolean;
		notifications: AppNotification[];
		unreadCount: number;
		onClose: () => void;
		onMarkAllRead: () => void;
		onSelect: (notification: AppNotification) => void;
	};

	type NotificationGroup = {
		label: string;
		items: AppNotification[];
	};

	let { open, notifications, unreadCount, onClose, onMarkAllRead, onSelect }: Props = $props();

	const groupedNotifications = $derived.by<NotificationGroup[]>(() => {
		const today: AppNotification[] = [];
		const yesterday: AppNotification[] = [];
		const earlier: AppNotification[] = [];
		const now = new Date();
		const startOfToday = new Date(now);
		startOfToday.setHours(0, 0, 0, 0);
		const startOfYesterday = new Date(startOfToday);
		startOfYesterday.setDate(startOfYesterday.getDate() - 1);

		for (const notification of notifications) {
			const createdAt = new Date(notification.createdAt);

			if (createdAt >= startOfToday) {
				today.push(notification);
				continue;
			}

			if (createdAt >= startOfYesterday) {
				yesterday.push(notification);
				continue;
			}

			earlier.push(notification);
		}

		return [
			{ label: 'Today', items: today },
			{ label: 'Yesterday', items: yesterday },
			{ label: 'Earlier', items: earlier }
		].filter((group) => group.items.length > 0);
	});

	function formatRelativeTime(value: string) {
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

	function toneClasses(notification: AppNotification) {
		if (notification.tone === 'success') {
			return 'bg-success text-primary-dark';
		}

		if (notification.tone === 'warning') {
			return 'bg-warning/55 text-[#664D03]';
		}

		return 'bg-info text-info-strong';
	}

	function kindLabel(notification: AppNotification) {
		if (notification.kind === 'payment') {
			return 'Payment';
		}

		if (notification.kind === 'onboarding') {
			return 'Onboarding';
		}

		if (notification.kind === 'team') {
			return 'Team';
		}

		return 'Booking';
	}
</script>

{#if open}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-primary-dark/30 backdrop-blur-sm"
		aria-label="Close notifications panel"
		onclick={onClose}
	></button>

	<div
		class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-sand bg-surface shadow-[0_24px_80px_rgba(8,39,23,0.12)]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="notifications-panel-title"
	>
		<div class="flex items-center justify-between gap-3 border-b border-sand px-5 py-4 sm:px-6">
			<div class="space-y-1">
				<p class="section-eyebrow">Live Updates</p>
				<h2 id="notifications-panel-title" class="font-display text-2xl font-semibold text-on-surface">
					Notifications
				</h2>
			</div>

			<div class="flex items-center gap-2">
				{#if unreadCount > 0}
					<button type="button" class="button-secondary text-xs" onclick={onMarkAllRead}>
						Mark all read
					</button>
				{/if}
				<button
					type="button"
					class="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sand bg-background text-lg text-on-surface"
					aria-label="Close notifications"
					onclick={onClose}
				>
					x
				</button>
			</div>
		</div>

		<div class="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
			{#if notifications.length === 0}
				<div class="rounded-[24px] border border-dashed border-sand bg-background px-5 py-6 text-sm leading-7 text-on-surface-variant">
					No notifications yet. New bookings, payment changes, and onboarding completions will appear here in real time.
				</div>
			{:else}
				{#each groupedNotifications as group}
					<section class="space-y-3">
						<p class="section-eyebrow">{group.label}</p>

						<div class="space-y-3">
							{#each group.items as notification}
								<button
									type="button"
									class={`w-full rounded-[24px] border px-4 py-4 text-left transition hover:border-primary/25 hover:bg-white ${
										notification.read
											? 'border-sand bg-background'
											: 'border-primary/20 bg-success/30'
									}`}
									onclick={() => onSelect(notification)}
								>
									<div class="flex items-start gap-3">
										<div class={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${toneClasses(notification)}`}>
											{kindLabel(notification)}
										</div>

										<div class="min-w-0 flex-1 space-y-1">
											<div class="flex items-start justify-between gap-3">
												<p class="text-sm font-semibold text-on-surface">{notification.title}</p>
												{#if !notification.read}
													<span class="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary"></span>
												{/if}
											</div>
											<p class="text-sm leading-6 text-on-surface-variant">{notification.detail}</p>
											<p class="text-xs text-on-surface-variant">{formatRelativeTime(notification.createdAt)}</p>
										</div>
									</div>
								</button>
							{/each}
						</div>
					</section>
				{/each}
			{/if}
		</div>
	</div>
{/if}
