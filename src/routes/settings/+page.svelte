<script lang="ts">
	import PlaceholderPage from '$lib/components/PlaceholderPage.svelte';

	const notes = [
		'Personal profile settings for the current staff user.',
		'Environment notes and non-destructive admin diagnostics.',
		'Expanded controls later if the product scope adds them.'
	];
</script>

<PlaceholderPage
	title="Settings"
	description="Settings is available to every staff role and provides a stable endpoint for later profile and preference work."
	{notes}
/>
