<script lang="ts">
import { goto } from '$app/navigation';

import { finalizeStaffInviteSession } from '$lib/staffInvites';
import { getSupabaseBrowserClient } from '$lib/supabase';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (loading) {
			return;
		}

		loading = true;
		errorMessage = '';

		const supabase = getSupabaseBrowserClient();
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			errorMessage = error.message;
			loading = false;
			return;
		}

		try {
			await finalizeStaffInviteSession();
		} catch (finalizeError) {
			await supabase.auth.signOut();
			errorMessage =
				finalizeError instanceof Error
					? finalizeError.message
					: 'Could not finish linking your staff access.';
			loading = false;
			return;
		}

		await goto('/', { invalidateAll: true });
		loading = false;
	}
</script>

<svelte:head>
	<title>Login | Authentic Admin</title>
</svelte:head>

<div class="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
	<section class="relative hidden overflow-hidden bg-primary-dark px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
		<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]"></div>
		<div class="relative space-y-5">
			<div class="inline-flex h-14 w-14 items-center justify-center rounded-3xl border border-white/12 bg-white/8 font-display text-3xl font-semibold">
				A
			</div>
			<div class="space-y-3">
				<p class="section-eyebrow text-white/70">Authentic Admin Panel</p>
				<h1 class="font-display text-5xl leading-tight font-semibold">Guide every conversation with clarity.</h1>
				<p class="max-w-xl text-base leading-8 text-white/72">
					This control panel is reserved for admins, moderators, and guides supporting the Authentic community.
				</p>
			</div>
		</div>

		<div class="relative grid gap-4 md:grid-cols-2">
			<div class="rounded-[24px] border border-white/12 bg-white/8 p-5">
				<p class="section-eyebrow text-white/70">Access rules</p>
				<p class="mt-3 text-sm leading-7 text-white/80">
					Members are blocked at the layout guard and sent to an access-denied view immediately after sign-in.
				</p>
			</div>
			<div class="rounded-[24px] border border-white/12 bg-white/8 p-5">
				<p class="section-eyebrow text-white/70">Milestone 1</p>
				<p class="mt-3 text-sm leading-7 text-white/80">
					Role-aware shell, protected routes, and placeholder pages are all wired and ready for data work.
				</p>
			</div>
		</div>
	</section>

	<section class="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
		<div class="w-full max-w-md rounded-[32px] border border-sand bg-surface p-6 shadow-[0_24px_80px_rgba(8,39,23,0.08)] sm:p-8">
			<div class="space-y-2">
				<p class="section-eyebrow">Staff Sign In</p>
				<h2 class="panel-title">Welcome back.</h2>
				<p class="text-sm leading-7 text-on-surface-variant">
					Use your staff email and password to enter the admin panel.
				</p>
			</div>

			<form class="mt-8 space-y-5" onsubmit={handleSubmit}>
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="email">Email</label>
					<input id="email" type="email" bind:value={email} class="input-base" placeholder="name@example.com" autocomplete="email" required />
				</div>

				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="password">Password</label>
					<input id="password" type="password" bind:value={password} class="input-base" placeholder="Enter your password" autocomplete="current-password" required />
				</div>

				{#if errorMessage}
					<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
						{errorMessage}
					</div>
				{/if}

				<button type="submit" class="button-primary w-full" disabled={loading}>
					{loading ? 'Signing in...' : 'Sign In'}
				</button>
			</form>
		</div>
	</section>
</div>
