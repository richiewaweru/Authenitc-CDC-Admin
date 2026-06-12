<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	function buildPageHref(page: number) {
		const params = new URLSearchParams();

		if (data.filters.state !== 'all') {
			params.set('state', data.filters.state);
		}

		if (data.filters.search) {
			params.set('search', data.filters.search);
		}

		params.set('page', `${page}`);
		return `/members?${params.toString()}`;
	}

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

	function formatLastSeen(value: string | null) {
		if (!value) {
			return 'No sign-in recorded yet';
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function formatBookingMoment(date: string | null, time: string | null) {
		if (!date) {
			return 'No booking history yet';
		}

		return [date, time].filter(Boolean).join(' | ');
	}
</script>

<svelte:head>
	<title>Members | Authentic Admin</title>
</svelte:head>

<section class="space-y-8">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div class="space-y-2">
			<p class="section-eyebrow">Milestone 6</p>
			<h1 class="panel-title">Members</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Review member progress, open their onboarding profile, and keep staff visibility scoped to
				the people each guide actually supports.
			</p>
		</div>

		{#if data.role === 'guide'}
			<div class="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-on-surface-variant">
				Guide accounts only see members connected to their own bookings.
			</div>
		{/if}
	</div>

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
			<p class="section-eyebrow">Visible Members</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.totalVisible}</p>
			<p class="text-sm text-on-surface-variant">Members currently in your allowed scope.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Onboarding Ready</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.onboardingReady}</p>
			<p class="text-sm text-on-surface-variant">Profiles with an onboarding submission on file.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Needs Review</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.needsReview}</p>
			<p class="text-sm text-on-surface-variant">Members waiting on staff follow-up after onboarding.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Suspended</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.suspended}</p>
			<p class="text-sm text-on-surface-variant">Accounts currently blocked from normal member access.</p>
		</div>
	</div>

	<div class="shell-card space-y-5">
		<form method="GET" class="grid gap-4 lg:grid-cols-[1.2fr_0.7fr_auto]">
			<label class="space-y-2">
				<span class="text-sm font-medium text-on-surface">Search members</span>
				<div class="relative">
					<Icon
						name="search"
						className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
					/>
					<input
						type="search"
						name="search"
						value={data.filters.search}
						class="input-base pl-11"
						placeholder="Search by name, email, state, or guide"
					/>
				</div>
			</label>

			<label class="space-y-2">
				<span class="text-sm font-medium text-on-surface">Directory view</span>
				<select id="state" name="state" class="input-base">
					<option value="all" selected={data.filters.state === 'all'}>All members</option>
					<option value="review" selected={data.filters.state === 'review'}>Needs review</option>
					<option value="onboarded" selected={data.filters.state === 'onboarded'}>Onboarded</option>
					<option value="active" selected={data.filters.state === 'active'}>Active members</option>
					<option value="suspended" selected={data.filters.state === 'suspended'}>Suspended</option>
				</select>
			</label>

			<div class="flex items-end">
				<button type="submit" class="button-primary w-full lg:w-auto">Apply</button>
			</div>
		</form>

		{#if data.members.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background px-6 py-10 text-center">
				<p class="font-display text-2xl font-semibold text-on-surface">No members match this view.</p>
				<p class="mx-auto mt-2 max-w-2xl text-sm leading-7 text-on-surface-variant">
					{data.role === 'guide'
						? 'When a member books with you, they will appear here together with their onboarding and preferences profile.'
						: 'Try clearing the current filters or wait for more member profiles to complete onboarding.'}
				</p>
			</div>
		{:else}
			<div class="grid min-w-0 gap-4 xl:grid-cols-2">
				{#each data.members as member}
					<a
						href={`/members/${member.id}`}
						class="shell-card block min-w-0 space-y-4 overflow-hidden hover:-translate-y-0.5"
					>
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
							<Avatar
								initials={member.label
									.split(/\s+/)
									.slice(0, 2)
									.map((part) => part.charAt(0).toUpperCase())
									.join('') || 'M'}
								name={member.label}
								src={member.avatarUrl}
								size="lg"
							/>

							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="break-words font-display text-2xl font-semibold text-on-surface">
										{member.label}
									</h2>
									<span class={`badge ${stateTone(member.userState)}`}>{formatState(member.userState)}</span>
									{#if member.suspended}
										<span class="badge bg-error text-error-strong">Suspended</span>
									{/if}
								</div>
								<p class="break-all text-sm text-on-surface-variant sm:truncate">{member.email}</p>
							</div>
						</div>

						<div class="grid gap-3 sm:grid-cols-2">
							<div class="rounded-2xl border border-sand bg-background px-4 py-3">
								<p class="section-eyebrow">Onboarding</p>
								<p class="mt-2 font-semibold text-on-surface">
									{member.onboardingReady ? 'Submitted' : 'Pending'}
								</p>
								<p class="mt-1 text-sm text-on-surface-variant">
									{member.preferencesReady ? 'Preferences included' : 'Preferences not submitted yet'}
								</p>
							</div>

							<div class="rounded-2xl border border-sand bg-background px-4 py-3">
								<p class="section-eyebrow">Bookings</p>
								<p class="mt-2 font-semibold text-on-surface">{member.totalBookings}</p>
								<p class="mt-1 text-sm text-on-surface-variant">
									{member.confirmedBookings} confirmed | {member.completedBookings} completed
								</p>
							</div>
						</div>

						<div class="grid gap-3 lg:grid-cols-2">
							<div class="space-y-1">
								<p class="section-eyebrow">Latest session</p>
								<p class="text-sm font-medium text-on-surface">
									{formatBookingMoment(member.latestBookingDate, member.latestBookingTime)}
								</p>
							</div>

							<div class="space-y-1">
								<p class="section-eyebrow">Last sign-in</p>
								<p class="text-sm font-medium text-on-surface">{formatLastSeen(member.lastSignInAt)}</p>
							</div>
						</div>

						<div class="space-y-1">
							<p class="section-eyebrow">Connected guides</p>
							<p class="text-sm leading-7 text-on-surface-variant">
								{member.guideLabels.length > 0 ? member.guideLabels.join(', ') : 'No guide has been assigned yet.'}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		{#if data.pagination.totalPages > 1}
			<div class="flex flex-col gap-3 border-t border-sand pt-4 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
				<p>
					Page {data.pagination.page} of {data.pagination.totalPages}
					<span class="text-on-surface">| {data.pagination.totalCount} matching members</span>
				</p>

				<div class="flex gap-3">
					{#if data.pagination.page > 1}
						<a class="button-secondary" href={buildPageHref(data.pagination.page - 1)}>Previous</a>
					{/if}
					{#if data.pagination.page < data.pagination.totalPages}
						<a class="button-secondary" href={buildPageHref(data.pagination.page + 1)}>Next</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</section>
