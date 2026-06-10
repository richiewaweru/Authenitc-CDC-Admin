<script lang="ts">
	import PlaceholderPage from '$lib/components/PlaceholderPage.svelte';

	const notes = [
		'Bookings overview cards, tabs, filters, and pagination.',
		'Detail slide-over with completion and cancellation actions.',
		'Guide-only scoping for assigned conversations.'
	];
</script>

<PlaceholderPage
	title="Bookings"
	description="Bookings lives inside the authenticated shell now, with the role model already prepared for admin, moderator, and guide views."
	{notes}
/>
