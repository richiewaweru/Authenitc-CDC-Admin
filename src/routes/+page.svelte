<script lang="ts">
	const cards = [
		{
			label: 'Pending Bookings',
			value: 'Placeholder',
			href: '/bookings',
			note: 'Real counts land in Milestone 2'
		},
		{
			label: "Today's Calls",
			value: 'Placeholder',
			href: '/slots',
			note: 'Uses actual slot data next'
		},
		{
			label: 'Total Members',
			value: 'Placeholder',
			href: '/members',
			note: 'Profiles query arrives in the dashboard pass'
		},
		{
			label: 'Active Guides',
			value: 'Placeholder',
			href: '/guides',
			note: 'Guide-only shell behavior is already wired'
		}
	];
</script>

<section class="space-y-8">
	<div class="space-y-2">
		<p class="section-eyebrow">Milestone 1 Complete</p>
		<h1 class="panel-title">Dashboard shell is ready for live data.</h1>
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
			Auth, role-aware routing, the global shell, and placeholder routes are now in place. The next milestone can focus purely on real dashboard queries and realtime activity.
		</p>
	</div>

	<div class="grid gap-4 xl:grid-cols-4">
		{#each cards as card}
			<a href={card.href} class="shell-card block space-y-4 hover:-translate-y-0.5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="section-eyebrow">{card.label}</p>
						<p class="mt-4 font-display text-3xl font-semibold text-on-surface">{card.value}</p>
					</div>
					<span class="badge bg-background text-on-surface-variant">Soon</span>
				</div>
				<p class="text-sm text-on-surface-variant">{card.note}</p>
			</a>
		{/each}
	</div>

	<div class="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
		<div class="shell-card space-y-4">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="section-eyebrow">Recent Activity</p>
					<h2 class="font-display text-2xl font-semibold">Realtime-ready placeholder</h2>
				</div>
				<a href="/bookings" class="button-secondary">Open bookings</a>
			</div>

			<div class="space-y-3">
				<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
					New bookings, onboarding completions, and guide activity will stream into this panel in Milestone 2.
				</div>
				<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
					The shell already reserves the card structure and spacing from the wireframes so the data pass can drop in cleanly.
				</div>
			</div>
		</div>

		<div class="shell-card space-y-4">
			<p class="section-eyebrow">Next Steps</p>
			<h2 class="font-display text-2xl font-semibold">Milestone 2 focus</h2>
			<ul class="space-y-3 text-sm leading-7 text-on-surface-variant">
				<li class="flex gap-3">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
					<span>Load role-aware dashboard counts from Supabase.</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
					<span>Render upcoming conversations and needs-attention panels.</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
					<span>Attach bookings realtime subscription in the dashboard experience.</span>
				</li>
			</ul>
		</div>
	</div>
</section>
