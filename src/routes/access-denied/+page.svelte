<script lang="ts">
	import { goto } from '$app/navigation';

	import { getSupabaseBrowserClient } from '$lib/supabase';

	let signingOut = $state(false);

	async function signOut() {
		if (signingOut) {
			return;
		}

		signingOut = true;
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		await goto('/login', { invalidateAll: true, replaceState: true });
		signingOut = false;
	}
</script>

<svelte:head>
	<title>Access Denied | Authentic Admin</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-10">
	<div class="card w-full max-w-xl space-y-6 p-8 text-center">
		<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-warning/40 font-display text-3xl font-semibold text-primary-dark">
			!
		</div>
		<div class="space-y-2">
			<p class="section-eyebrow">Restricted Area</p>
			<h1 class="panel-title">This account doesn’t have staff access.</h1>
			<p class="text-sm leading-7 text-on-surface-variant">
				The Authentic admin panel is limited to admins, moderators, and guides. If you expected access, have an admin verify your role in Supabase.
			</p>
		</div>
		<div class="flex flex-col justify-center gap-3 sm:flex-row">
			<a href="/login" class="button-secondary">Back to login</a>
			<button type="button" class="button-primary" onclick={signOut}>
				{signingOut ? 'Signing out...' : 'Sign out'}
			</button>
		</div>
	</div>
</div>
