<script lang="ts">
	type Props = {
		title: string;
		description: string;
		notes?: string[];
	};

	let { title, description, notes = [] }: Props = $props();
</script>

<section class="space-y-6">
	<div class="space-y-2">
		<p class="section-eyebrow">Milestone 1 Placeholder</p>
		<h1 class="panel-title">{title}</h1>
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">{description}</p>
	</div>

	<div class="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
		<div class="shell-card space-y-4">
			<h2 class="font-display text-2xl font-semibold">What lands in later milestones</h2>
			<ul class="space-y-3 text-sm leading-7 text-on-surface-variant">
				{#each notes as note}
					<li class="flex gap-3">
						<span class="mt-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
						<span>{note}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="shell-card space-y-4">
			<h2 class="font-display text-2xl font-semibold">Current checkpoint</h2>
			<p class="text-sm leading-7 text-on-surface-variant">
				This route is wired into the authenticated shell and ready for milestone-specific data and UI work.
			</p>
			<div class="rounded-3xl border border-dashed border-sand bg-background p-4 text-sm text-on-surface-variant">
				Role-aware navigation and route guards are already active here.
			</div>
		</div>
	</div>
</section>
