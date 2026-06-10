<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/AppShell.svelte';
	import { setAuthState } from '$lib/stores/auth';
	import { isStaffRole } from '$lib/types';

	let { children, data } = $props();

	$effect(() => {
		setAuthState({
			session: data.session,
			role: data.role,
			user: data.user
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Authentic Admin</title>
</svelte:head>

{#if data.layoutMode === 'app' && isStaffRole(data.role) && data.user}
	<AppShell role={data.role} user={data.user} navigation={data.navigation}>
		{@render children()}
	</AppShell>
{:else}
	<div class="min-h-screen">
		{@render children()}
	</div>
{/if}
