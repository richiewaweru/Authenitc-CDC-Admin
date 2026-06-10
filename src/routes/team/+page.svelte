<script lang="ts">
	import PlaceholderPage from '$lib/components/PlaceholderPage.svelte';

	const notes = [
		'Admin roster, moderator management, and pending invite workflows.',
		'Guide linkage and pending-vs-linked visibility.',
		'Permissions panel matching the wireframe and role matrix.'
	];
</script>

<PlaceholderPage
	title="Team Management"
	description="This page is already hard-guarded to admins only and hidden from the sidebar for moderators and guides."
	{notes}
/>
