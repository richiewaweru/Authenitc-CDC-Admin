<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Avatar from '$lib/components/Avatar.svelte';

	type BookingRow = (typeof data.bookings)[number];

	let { data, form } = $props();

	let actionSubmitting = $state<'complete' | 'cancel' | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);
	let cancelReason = $state('');

	function buildFilters(params: Partial<Record<string, string | number | null | undefined>> = {}) {
		const searchParams = new URLSearchParams();
		searchParams.set('tab', params.tab?.toString() ?? data.filters.tab);
		searchParams.set('status', params.status?.toString() ?? data.filters.status);
		searchParams.set('payment', params.payment?.toString() ?? data.filters.payment);
		searchParams.set('range', params.range?.toString() ?? data.filters.range);
		searchParams.set('page', params.page?.toString() ?? data.pagination.page.toString());

		const guideValue = params.guide?.toString() ?? data.filters.guide;
		if (data.role !== 'guide' && guideValue !== 'all') {
			searchParams.set('guide', guideValue);
		}

		const searchValue = params.search?.toString() ?? data.filters.search;
		if (searchValue) {
			searchParams.set('search', searchValue);
		}

		const bookingValue = params.booking?.toString();
		if (bookingValue) {
			searchParams.set('booking', bookingValue);
		}

		return `/bookings?${searchParams.toString()}`;
	}

	function showToast(message: string, tone: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastTone = tone;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	function formatDateTime(value: string | null) {
		if (!value) {
			return 'Schedule unavailable';
		}

		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function formatCurrency(amount: number, currency: string) {
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: currency.toUpperCase()
			}).format(amount || 0);
		} catch {
			return `${currency.toUpperCase()} ${amount || 0}`;
		}
	}

	function bookingStatusTone(status: BookingRow['status']) {
		switch (status) {
			case 'completed':
				return 'bg-[#DCE8FF] text-[#214D9C]';
			case 'cancelled':
				return 'bg-error text-error-strong';
			case 'no_show':
				return 'bg-background text-on-surface-variant';
			default:
				return 'bg-warning/55 text-[#664D03]';
		}
	}

	function paymentTone(status: BookingRow['paymentStatus']) {
		switch (status) {
			case 'paid':
				return 'bg-success text-primary-dark';
			case 'refunded':
				return 'bg-background text-on-surface-variant';
			case 'failed':
				return 'bg-error text-error-strong';
			default:
				return 'bg-warning/55 text-[#664D03]';
		}
	}

	function actionEnhance(kind: 'complete' | 'cancel'): SubmitFunction {
		return () => {
			actionSubmitting = kind;

			return async ({ result, update }) => {
				actionSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Booking updated.');
					cancelReason = '';
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not update this booking.'
						: 'Something went wrong while updating this booking.',
					'error'
				);
			};
		};
	}
</script>

<svelte:head>
	<title>Bookings | Authentic Admin</title>
</svelte:head>

{#if toastVisible}
	<div
		class={`fixed right-4 top-4 z-50 max-w-sm rounded-2xl border px-5 py-3 text-sm font-medium shadow-lg ${
			toastTone === 'success'
				? 'border-green-200 bg-success text-primary-dark'
				: 'border-red-200 bg-error text-error-strong'
		}`}
	>
		{toastMessage}
	</div>
{/if}

<section class="space-y-8">
	<div class="space-y-2">
		<p class="section-eyebrow">Milestone 5</p>
		<h1 class="panel-title">Bookings</h1>
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
			Review every conversation in one place, check payment readiness, and move confirmed sessions
			through completion or cancellation without losing slot alignment.
		</p>
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Booking Data Issues</p>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-3">
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Active Sessions</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.activeSessions}</p>
			<p class="text-sm text-on-surface-variant">Confirmed sessions still in flight.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Pending Payments</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.pendingPayments}</p>
			<p class="text-sm text-on-surface-variant">Bookings still carrying a pending payment state.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Capacity</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.capacityPercent}%</p>
			<p class="text-sm text-on-surface-variant">Booked or completed slot share in the current scope.</p>
		</div>
	</div>

	<div class="shell-card space-y-5">
		<form
			method="GET"
			class="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,160px)_minmax(0,180px)_minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)]"
		>
				<input type="hidden" name="tab" value={data.filters.tab} />
				<input type="hidden" name="page" value="1" />

				<div class="min-w-0 space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="status">Status</label>
					<select id="status" name="status" class="input-base">
						<option value="all" selected={data.filters.status === 'all'}>All statuses</option>
						<option value="confirmed" selected={data.filters.status === 'confirmed'}>Confirmed</option>
						<option value="completed" selected={data.filters.status === 'completed'}>Completed</option>
						<option value="cancelled" selected={data.filters.status === 'cancelled'}>Cancelled</option>
						<option value="no_show" selected={data.filters.status === 'no_show'}>No show</option>
					</select>
				</div>

				{#if data.role !== 'guide'}
					<div class="min-w-0 space-y-2">
						<label class="text-sm font-semibold text-on-surface" for="guide">Guide</label>
						<select id="guide" name="guide" class="input-base">
							<option value="all" selected={data.filters.guide === 'all'}>All guides</option>
							{#each data.guides as guide}
								<option value={guide.id} selected={data.filters.guide === guide.id}>
									{guide.label}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="min-w-0 space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="payment">Payment</label>
					<select id="payment" name="payment" class="input-base">
						<option value="all" selected={data.filters.payment === 'all'}>All payments</option>
						<option value="pending" selected={data.filters.payment === 'pending'}>Pending</option>
						<option value="paid" selected={data.filters.payment === 'paid'}>Paid</option>
						<option value="refunded" selected={data.filters.payment === 'refunded'}>Refunded</option>
						<option value="failed" selected={data.filters.payment === 'failed'}>Failed</option>
					</select>
				</div>

				<div class="min-w-0 space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="range">Date range</label>
					<select id="range" name="range" class="input-base">
						<option value="all" selected={data.filters.range === 'all'}>All dates</option>
						<option value="this_week" selected={data.filters.range === 'this_week'}>This week</option>
						<option value="next_30_days" selected={data.filters.range === 'next_30_days'}>Next 30 days</option>
						<option value="past" selected={data.filters.range === 'past'}>Past sessions</option>
					</select>
				</div>

				<div class="min-w-0 space-y-2 sm:col-span-2 lg:col-span-3 2xl:col-span-1">
					<label class="text-sm font-semibold text-on-surface" for="search">Search</label>
					<input
						id="search"
						name="search"
						type="search"
						value={data.filters.search}
						class="input-base min-w-0"
						placeholder="Search members or guides"
					/>
				</div>

				<div class="flex flex-col gap-3 sm:col-span-2 sm:flex-row lg:col-span-3 2xl:col-span-5 2xl:justify-end">
					<button type="submit" class="button-primary">Apply</button>
					<a
						href={buildFilters({ tab: data.filters.tab, page: 1, search: '', guide: 'all', status: 'all', payment: 'all', range: 'all' })}
						class="button-secondary"
					>
						Reset
					</a>
				</div>
		</form>

		<div class="space-y-2 border-t border-sand/80 pt-4">
			<p class="text-sm text-on-surface-variant">
				Search and date range work together, so you can narrow the roster by both timing and member or guide details.
			</p>
			<div class="flex flex-wrap gap-3">
				<a
					href={buildFilters({ tab: 'all', page: 1, booking: null })}
					class={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
						data.filters.tab === 'all'
							? 'border-primary bg-primary text-white'
							: 'border-sand bg-background text-on-surface-variant'
					}`}
				>
					All ({data.tabCounts.all})
				</a>
				<a
					href={buildFilters({ tab: 'upcoming', page: 1, booking: null })}
					class={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
						data.filters.tab === 'upcoming'
							? 'border-primary bg-primary text-white'
							: 'border-sand bg-background text-on-surface-variant'
					}`}
				>
					Upcoming ({data.tabCounts.upcoming})
				</a>
				<a
					href={buildFilters({ tab: 'pending_pay', page: 1, booking: null })}
					class={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
						data.filters.tab === 'pending_pay'
							? 'border-primary bg-primary text-white'
							: 'border-sand bg-background text-on-surface-variant'
					}`}
				>
					Pending Pay ({data.tabCounts.pending_pay})
				</a>
			</div>
		</div>

		{#if data.bookings.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No bookings match these filters.</p>
				<p class="mt-2 text-sm text-on-surface-variant">
					Adjust the filters, or wait for the next booked conversation to land in the roster.
				</p>
			</div>
		{:else}
			<div class="space-y-4 md:hidden">
				{#each data.bookings as booking}
					<div class="rounded-[24px] border border-sand bg-background px-4 py-4">
						<div class="flex items-start gap-3">
							<Avatar initials={booking.memberLabel.slice(0, 2).toUpperCase()} name={booking.memberLabel} />
							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold text-on-surface">{booking.memberLabel}</p>
									<span class={`badge ${bookingStatusTone(booking.status)}`}>{booking.status}</span>
								</div>
								<p class="text-xs text-on-surface-variant">{booking.memberEmail}</p>
								<p class="text-sm text-on-surface-variant">{booking.guideLabel} | {booking.guideTitle}</p>
								<p class="text-sm font-medium text-on-surface">{formatDateTime(booking.startsAt)}</p>
								<div class="flex flex-wrap gap-2">
									<span class={`badge ${paymentTone(booking.paymentStatus)}`}>
										{booking.paymentStatus}
									</span>
									<span class="badge bg-background text-on-surface-variant">
										{formatCurrency(booking.amountPaid, booking.currency)}
									</span>
									<span class="badge bg-background text-on-surface-variant">
										{booking.durationMinutes} minutes
									</span>
								</div>
								<a class="button-secondary w-full text-xs sm:w-auto" href={buildFilters({ booking: booking.id })}>
									View booking
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="hidden overflow-x-auto md:block">
				<table class="min-w-full border-separate border-spacing-0">
					<thead>
						<tr class="text-left">
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Member
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Guide
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Schedule
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Payment
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Status
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{#each data.bookings as booking}
							<tr class="align-top">
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="flex items-center gap-3">
										<Avatar initials={booking.memberLabel.slice(0, 2).toUpperCase()} name={booking.memberLabel} />
										<div class="min-w-0">
											<p class="truncate text-sm font-semibold text-on-surface">{booking.memberLabel}</p>
											<p class="truncate text-xs text-on-surface-variant">{booking.memberEmail}</p>
										</div>
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<p class="text-sm font-semibold text-on-surface">{booking.guideLabel}</p>
									<p class="text-xs text-on-surface-variant">{booking.guideTitle}</p>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<p class="text-sm font-semibold text-on-surface">{formatDateTime(booking.startsAt)}</p>
									<p class="text-xs text-on-surface-variant">{booking.durationMinutes} minutes</p>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="space-y-2">
										<p class="text-sm font-semibold text-on-surface">
											{formatCurrency(booking.amountPaid, booking.currency)}
										</p>
										<span class={`badge ${paymentTone(booking.paymentStatus)}`}>
											{booking.paymentStatus}
										</span>
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<span class={`badge ${bookingStatusTone(booking.status)}`}>
										{booking.status}
									</span>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<a class="button-secondary text-xs" href={buildFilters({ booking: booking.id })}>
										View
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm text-on-surface-variant">
				Page {data.pagination.page} of {data.pagination.totalPages} | {data.pagination.totalCount} bookings
			</p>

			<div class="flex gap-3">
				{#if data.pagination.page > 1}
					<a class="button-secondary" href={buildFilters({ page: data.pagination.page - 1 })}>
						Previous
					</a>
				{/if}
				{#if data.pagination.page < data.pagination.totalPages}
					<a class="button-secondary" href={buildFilters({ page: data.pagination.page + 1 })}>
						Next
					</a>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if data.selectedBooking}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		onclick={() => (window.location.href = buildFilters({ booking: null }))}
		onkeydown={(event) => event.key === 'Escape' && (window.location.href = buildFilters({ booking: null }))}
	></div>

	<div class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:max-w-xl sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">Booking detail</p>
				<h2 class="panel-title">{data.selectedBooking.memberLabel} with {data.selectedBooking.guideLabel}</h2>
				<p class="text-sm leading-7 text-on-surface-variant">
					Review the session schedule, payment details, and any staff follow-through needed on this booking.
				</p>
			</div>

			<a class="button-secondary" href={buildFilters({ booking: null })}>Close</a>
		</div>

		<div class="mt-8 space-y-5">
			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="section-eyebrow">Member</p>
				<div class="mt-4 flex items-center gap-4">
					<Avatar
						initials={data.selectedBooking.memberLabel.slice(0, 2).toUpperCase()}
						name={data.selectedBooking.memberLabel}
						src={data.selectedBooking.memberAvatarUrl}
						size="lg"
					/>
					<div class="space-y-1">
						<p class="text-sm font-semibold text-on-surface">{data.selectedBooking.memberLabel}</p>
						<p class="text-sm text-on-surface-variant">{data.selectedBooking.memberEmail}</p>
						<p class="text-xs uppercase tracking-[0.12em] text-on-surface-variant">
							{data.selectedBooking.memberRole}
						</p>
					</div>
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="section-eyebrow">Guide</p>
				<div class="mt-4 flex items-center gap-4">
					<Avatar
						initials={data.selectedBooking.guideInitials ?? data.selectedBooking.guideLabel.slice(0, 2).toUpperCase()}
						name={data.selectedBooking.guideLabel}
						src={data.selectedBooking.guideAvatarUrl}
						size="lg"
					/>
					<div class="space-y-1">
						<p class="text-sm font-semibold text-on-surface">{data.selectedBooking.guideLabel}</p>
						<p class="text-sm text-on-surface-variant">{data.selectedBooking.guideTitle}</p>
						<p class="text-xs text-on-surface-variant">
							{data.selectedBooking.guideActive ? 'Active guide' : 'Inactive guide'}
						</p>
					</div>
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-[24px] border border-sand bg-background p-4">
					<p class="section-eyebrow">Schedule</p>
					<p class="mt-3 text-sm font-semibold text-on-surface">
						{formatDateTime(data.selectedBooking.startsAt)}
					</p>
					<p class="mt-1 text-sm text-on-surface-variant">
						{data.selectedBooking.durationMinutes} minutes
					</p>
				</div>

				<div class="rounded-[24px] border border-sand bg-background p-4">
					<p class="section-eyebrow">Payment</p>
					<p class="mt-3 text-sm font-semibold text-on-surface">
						{formatCurrency(data.selectedBooking.amountPaid, data.selectedBooking.currency)}
					</p>
					<div class="mt-2 flex flex-wrap gap-2">
						<span class={`badge ${paymentTone(data.selectedBooking.paymentStatus)}`}>
							{data.selectedBooking.paymentStatus}
						</span>
						<span class={`badge ${bookingStatusTone(data.selectedBooking.status)}`}>
							{data.selectedBooking.status}
						</span>
					</div>
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="section-eyebrow">Session notes</p>
				<div class="mt-3 space-y-2 text-sm text-on-surface-variant">
					<p>Booking id: {data.selectedBooking.id}</p>
					<p>Slot id: {data.selectedBooking.slotId}</p>
					{#if data.selectedBooking.stripePaymentIntentId}
						<p>Payment intent: {data.selectedBooking.stripePaymentIntentId}</p>
					{/if}
					{#if data.selectedBooking.cancelReason}
						<p>Cancel reason: {data.selectedBooking.cancelReason}</p>
					{/if}
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="section-eyebrow">Meeting link</p>
				{#if data.selectedBooking.meetingLink}
					<a
						href={data.selectedBooking.meetingLink}
						target="_blank"
						rel="noreferrer"
						class="mt-3 block text-sm text-primary underline break-all"
					>
						{data.selectedBooking.meetingLink}
					</a>
				{:else}
					<p class="mt-3 text-sm italic text-on-surface-variant">
						No meeting link set yet - add one from the Slots page.
					</p>
				{/if}
			</div>

			{#if form?.message}
				<div class="rounded-3xl border border-sand bg-background px-4 py-3 text-sm text-on-surface-variant">
					{form.message}
				</div>
			{/if}

			<div class="space-y-4 rounded-[24px] border border-sand bg-background p-4">
				<p class="section-eyebrow">Actions</p>

				{#if data.selectedBooking.canMarkComplete}
					<form method="POST" action="?/markComplete" use:enhance={actionEnhance('complete')} class="space-y-3">
						<input type="hidden" name="bookingId" value={data.selectedBooking.id} />
						<button type="submit" class="button-primary w-full" disabled={actionSubmitting === 'complete'}>
							{actionSubmitting === 'complete' ? 'Saving...' : 'Mark Complete'}
						</button>
					</form>
				{/if}

				{#if data.selectedBooking.canCancel}
					<form method="POST" action="?/cancelBooking" use:enhance={actionEnhance('cancel')} class="space-y-3">
						<input type="hidden" name="bookingId" value={data.selectedBooking.id} />
						<div class="space-y-2">
							<label class="text-sm font-semibold text-on-surface" for="cancelReason">Cancel reason</label>
							<textarea
								id="cancelReason"
								name="cancelReason"
								class="input-base min-h-24 resize-y"
								bind:value={cancelReason}
								placeholder="Explain why this booking is being cancelled"
							></textarea>
						</div>
						<button
							type="submit"
							class="inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-3 text-sm font-semibold text-error-strong hover:bg-error"
							disabled={actionSubmitting === 'cancel'}
						>
							{actionSubmitting === 'cancel' ? 'Saving...' : 'Cancel Booking'}
						</button>
					</form>
				{:else if data.role === 'guide'}
					<p class="text-sm text-on-surface-variant">
						Guide accounts can mark sessions complete, but cancellations stay with staff.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
