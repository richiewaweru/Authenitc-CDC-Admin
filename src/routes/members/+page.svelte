<script lang="ts">
	import PlaceholderPage from '$lib/components/PlaceholderPage.svelte';

	const notes = [
		'Member directory tabs with search and state filters.',
		'Scoped guide access to booked members only.',
		'Deep-link detail pages for onboarding, preferences, and activity.'
	];
</script>

<PlaceholderPage
	title="Members"
	description="Milestone 6 can build on this route without revisiting auth, shell layout, or role-based navigation."
	{notes}
/>
