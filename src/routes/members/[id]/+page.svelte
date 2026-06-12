<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';

	let { data, form } = $props();

	function formatState(value: string | null) {
		if (!value) {
			return 'Not started';
		}

		return value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function stateTone(value: string | null) {
		if (value === 'full_member' || value === 'membership_active') {
			return 'bg-success text-primary-dark';
		}

		if (value === 'onboarding_complete' || value === 'conversation_approved') {
			return 'bg-warning/55 text-[#664D03]';
		}

		return 'bg-background text-on-surface-variant';
	}

	function bookingTone(status: string) {
		if (status === 'completed') {
			return 'bg-success text-primary-dark';
		}

		if (status === 'cancelled' || status === 'no_show') {
			return 'bg-error text-error-strong';
		}

		return 'bg-warning/55 text-[#664D03]';
	}

	function paymentTone(status: string) {
		if (status === 'paid') {
			return 'bg-success text-primary-dark';
		}

		if (status === 'failed' || status === 'refunded') {
			return 'bg-error text-error-strong';
		}

		return 'bg-background text-on-surface-variant';
	}

	function formatDateTime(value: string | null) {
		if (!value) {
			return 'Not available';
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function formatMoney(amount: number, currency: string) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount);
	}

	function formatSlot(date: string | null, time: string | null) {
		return [date, time].filter(Boolean).join(' | ') || 'Schedule not recorded';
	}
</script>

<svelte:head>
	<title>{data.member.label} | Authentic Admin</title>
</svelte:head>

<section class="space-y-8">
	<div class="space-y-3">
		<a href="/members" class="text-sm font-medium text-primary hover:text-primary-dark">
			&larr; Back to members
		</a>
		<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
			<div class="flex items-start gap-4">
				<Avatar
					initials={data.member.label
						.split(/\s+/)
						.slice(0, 2)
						.map((part) => part.charAt(0).toUpperCase())
						.join('') || 'M'}
					name={data.member.label}
					src={data.member.avatarUrl}
					size="lg"
				/>

				<div class="space-y-2">
					<p class="section-eyebrow">Member Detail</p>
					<h1 class="panel-title">{data.member.label}</h1>
					<div class="flex flex-wrap gap-2">
						<RoleBadge role={data.member.accountRole} />
						<span class={`badge ${stateTone(data.member.userState)}`}>
							{formatState(data.member.userState)}
						</span>
						{#if data.member.suspended}
							<span class="badge bg-error text-error-strong">Suspended</span>
						{/if}
						{#if data.member.onboardingComplete}
							<span class="badge bg-success text-primary-dark">Onboarding on file</span>
						{/if}
					</div>
					<p class="text-sm text-on-surface-variant">{data.member.email}</p>
				</div>
			</div>

			{#if data.canSuspend || data.canPromote}
				<div class="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[300px]">
					{#if data.canSuspend}
						<form method="POST" action="?/suspend">
							<input type="hidden" name="memberId" value={data.member.id} />
							<input
								type="hidden"
								name="nextSuspended"
								value={data.member.suspended ? 'false' : 'true'}
							/>
							<button type="submit" class="button-secondary w-full">
								{data.member.suspended ? 'Restore member access' : 'Suspend member access'}
							</button>
						</form>
					{/if}

					{#if data.canPromote}
						<form method="POST" action="?/promote">
							<input type="hidden" name="memberId" value={data.member.id} />
							<button type="submit" class="button-primary w-full">Promote to moderator</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if form?.message}
		<div
			class={`shell-card ${form.success ? 'border-primary/20 bg-success/55 text-primary-dark' : 'border-red-200 bg-error/40 text-error-strong'}`}
		>
			<p class="text-sm font-medium">{form.message}</p>
		</div>
	{/if}

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Member Data Issues</p>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Bookings</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.bookingSummary.total}</p>
			<p class="text-sm text-on-surface-variant">Visible booking records for this member.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Confirmed</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.bookingSummary.confirmed}</p>
			<p class="text-sm text-on-surface-variant">Sessions still waiting to happen.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Completed</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.bookingSummary.completed}</p>
			<p class="text-sm text-on-surface-variant">Sessions already marked done.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Last Sign-In</p>
			<p class="font-display text-xl font-semibold text-on-surface">
				{formatDateTime(data.member.lastSignInAt)}
			</p>
			<p class="text-sm text-on-surface-variant">Most recent recorded member activity.</p>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
		<div class="shell-card space-y-4">
			<div class="space-y-1">
				<p class="section-eyebrow">Profile Summary</p>
				<h2 class="font-display text-2xl font-semibold text-on-surface">Account and timeline</h2>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-2xl border border-sand bg-background px-4 py-3">
					<p class="section-eyebrow">Created</p>
					<p class="mt-2 text-sm font-medium text-on-surface">
						{formatDateTime(data.member.createdAt)}
					</p>
				</div>
				<div class="rounded-2xl border border-sand bg-background px-4 py-3">
					<p class="section-eyebrow">Last Updated</p>
					<p class="mt-2 text-sm font-medium text-on-surface">
						{formatDateTime(data.member.updatedAt)}
					</p>
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
				<p class="section-eyebrow">Access Notes</p>
				<p class="mt-2 text-sm leading-7 text-on-surface-variant">
					{#if data.member.accountRole === 'member'}
						This account is still in the member directory and can be suspended here if staff access needs to
						be paused.
					{:else}
						This profile has already moved out of the member role, so promotion and member-only actions are
						no longer available on this screen.
					{/if}
				</p>
			</div>
		</div>

		<div class="shell-card space-y-4">
			<div class="space-y-1">
				<p class="section-eyebrow">Booking History</p>
				<h2 class="font-display text-2xl font-semibold text-on-surface">
					Guide connections and outcomes
				</h2>
			</div>

			{#if data.bookingHistory.length === 0}
				<div class="rounded-[24px] border border-dashed border-sand bg-background px-5 py-8 text-center">
					<p class="font-semibold text-on-surface">No bookings recorded yet.</p>
					<p class="mt-2 text-sm leading-7 text-on-surface-variant">
						This member will pick up guide and payment history here after their first scheduled session.
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each data.bookingHistory as booking}
						<a
							href={booking.href}
							class="block rounded-[24px] border border-sand bg-background px-5 py-4 hover:bg-surface"
						>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="space-y-2">
									<div class="flex flex-wrap gap-2">
										<span class={`badge ${bookingTone(booking.status)}`}>{booking.status}</span>
										<span class={`badge ${paymentTone(booking.paymentStatus)}`}>
											{booking.paymentStatus}
										</span>
									</div>
									<p class="font-semibold text-on-surface">{booking.guideLabel}</p>
									<p class="text-sm text-on-surface-variant">{booking.guideTitle}</p>
								</div>

								<div class="space-y-1 text-sm text-on-surface-variant sm:text-right">
									<p>{formatSlot(booking.slotDate, booking.slotTime)}</p>
									<p>{booking.durationMinutes} minute session</p>
									<p>{formatMoney(booking.amountPaid, booking.currency)}</p>
								</div>
							</div>

							{#if booking.cancelReason}
								<p class="mt-3 text-sm leading-7 text-on-surface-variant">
									<span class="font-semibold text-on-surface">Cancellation note:</span>
									{booking.cancelReason}
								</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<div class="shell-card space-y-4">
			<div class="space-y-1">
				<p class="section-eyebrow">Alignment Profile</p>
				<h2 class="font-display text-2xl font-semibold text-on-surface">Onboarding responses</h2>
			</div>

			{#if data.onboardingFields.length === 0}
				<div class="rounded-[24px] border border-dashed border-sand bg-background px-5 py-8 text-center">
					<p class="font-semibold text-on-surface">No onboarding submission yet.</p>
					<p class="mt-2 text-sm leading-7 text-on-surface-variant">
						Once the member completes the alignment questionnaire, their answers will appear here.
					</p>
				</div>
			{:else}
				<div class="grid gap-3 sm:grid-cols-2">
					{#each data.onboardingFields as field}
						<div class="rounded-2xl border border-sand bg-background px-4 py-3">
							<p class="section-eyebrow">{field.label}</p>
							<p class="mt-2 text-sm leading-7 text-on-surface">{field.value}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="shell-card space-y-4">
			<div class="space-y-1">
				<p class="section-eyebrow">Preferences</p>
				<h2 class="font-display text-2xl font-semibold text-on-surface">
					Matching boundaries and updates
				</h2>
			</div>

			{#if data.preferenceFields.length === 0}
				<div class="rounded-[24px] border border-dashed border-sand bg-background px-5 py-8 text-center">
					<p class="font-semibold text-on-surface">No preferences saved yet.</p>
					<p class="mt-2 text-sm leading-7 text-on-surface-variant">
						Preference ranges, dealbreakers, and notification settings will render here once submitted.
					</p>
				</div>
			{:else}
				<div class="grid gap-3 sm:grid-cols-2">
					{#each data.preferenceFields as field}
						<div class="rounded-2xl border border-sand bg-background px-4 py-3">
							<p class="section-eyebrow">{field.label}</p>
							<p class="mt-2 text-sm leading-7 text-on-surface">{field.value}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>
