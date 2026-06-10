<script lang="ts">
	import { page } from '$app/state';

	import PlaceholderPage from '$lib/components/PlaceholderPage.svelte';

	const memberId = $derived(page.params.id);
	const notes = [
		'Read-only onboarding and preferences panels from Supabase.',
		'Admin actions for suspension and moderator promotion.',
		'Guide visibility limited to members booked with the current guide.'
	];
</script>

<PlaceholderPage
	title={`Member Profile ${memberId ? `· ${memberId}` : ''}`}
	description="The dynamic member detail route is already registered and protected."
	{notes}
/>
