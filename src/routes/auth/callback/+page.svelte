<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';

import { finalizeStaffInviteSession } from '$lib/staffInvites';
import { getSupabaseBrowserClient } from '$lib/supabase';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(true);
	let submitting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let needsPassword = $state(false);
	let expired = $state(false);

	onMount(async () => {
		const supabase = getSupabaseBrowserClient();

		try {
			const { data, error } = await supabase.auth.getSession();

			if (error) {
				expired = true;
				errorMessage = 'This invite link is invalid or has expired.';
				loading = false;
				return;
			}

			if (data.session) {
				try {
					await finalizeStaffInviteSession();
				} catch {
					expired = true;
					errorMessage =
						'We could not finish linking your staff access. Please ask an admin to refresh your invite.';
					loading = false;
					return;
				}

				needsPassword = true;
			} else {
				expired = true;
				errorMessage = 'This invite link is invalid or has already been used.';
			}
		} catch {
			expired = true;
			errorMessage = 'Something went wrong while verifying your invite.';
		}

		loading = false;
	});

	function validatePassword(): string | null {
		if (newPassword.length < 8) {
			return 'Password must be at least 8 characters.';
		}

		if (newPassword !== confirmPassword) {
			return 'Passwords do not match.';
		}

		return null;
	}

	async function handleSetPassword(event: SubmitEvent) {
		event.preventDefault();

		const validationError = validatePassword();
		if (validationError) {
			errorMessage = validationError;
			return;
		}

		submitting = true;
		errorMessage = '';

		try {
			const supabase = getSupabaseBrowserClient();
			const { error } = await supabase.auth.updateUser({
				password: newPassword
			});

			if (error) {
				errorMessage = error.message || 'Could not set your password. Please try again.';
				submitting = false;
				return;
			}

			try {
				await finalizeStaffInviteSession();
			} catch {
				errorMessage =
					'Your password was set, but we could not finish linking your staff access. Please sign in again or ask an admin to refresh your invite.';
				submitting = false;
				return;
			}

			await supabase.auth.signOut();

			successMessage = 'Your password has been set. Redirecting to login...';

			setTimeout(() => {
				void goto('/login', { replaceState: true });
			}, 2000);
		} catch {
			errorMessage = 'Something went wrong. Please try again.';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Accept Invite | Authentic Admin</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-10">
	{#if loading}
		<div class="card w-full max-w-md space-y-6 p-8 text-center">
			<div
				class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sand border-t-primary"
			></div>
			<p class="text-sm text-on-surface-variant">Verifying your invite...</p>
		</div>
	{:else if successMessage}
		<div class="card w-full max-w-md space-y-6 p-8 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-success font-display text-3xl font-semibold text-primary"
			>
				&check;
			</div>
			<div class="space-y-2">
				<p class="section-eyebrow">You're all set</p>
				<h1 class="panel-title">{successMessage}</h1>
			</div>
		</div>
	{:else if expired}
		<div class="card w-full max-w-md space-y-6 p-8 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-warning/40 font-display text-3xl font-semibold text-primary-dark"
			>
				!
			</div>
			<div class="space-y-2">
				<p class="section-eyebrow">Invite Problem</p>
				<h1 class="panel-title">{errorMessage}</h1>
				<p class="text-sm leading-7 text-on-surface-variant">
					Please contact your admin to send a new invite. Invite links expire after 24 hours and can
					only be used once.
				</p>
			</div>
			<a href="/login" class="button-secondary">Go to login</a>
		</div>
	{:else if needsPassword}
		<div
			class="w-full max-w-md rounded-[32px] border border-sand bg-surface p-6 shadow-[0_24px_80px_rgba(8,39,23,0.08)] sm:p-8"
		>
			<div class="space-y-2">
				<p class="section-eyebrow">Welcome to the team</p>
				<h1 class="panel-title">Set your password.</h1>
				<p class="text-sm leading-7 text-on-surface-variant">
					Choose a secure password to complete your account setup. You'll use this to log in going
					forward.
				</p>
			</div>

			<form class="mt-8 space-y-5" onsubmit={handleSetPassword}>
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="new-password"
						>New password</label
					>
					<input
						id="new-password"
						type="password"
						bind:value={newPassword}
						class="input-base"
						placeholder="At least 8 characters"
						autocomplete="new-password"
						minlength={8}
						required
					/>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="confirm-password"
						>Confirm password</label
					>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						class="input-base"
						placeholder="Re-enter your password"
						autocomplete="new-password"
						minlength={8}
						required
					/>
				</div>

				{#if errorMessage && !expired}
					<div
						class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong"
					>
						{errorMessage}
					</div>
				{/if}

				<button type="submit" class="button-primary w-full" disabled={submitting}>
					{submitting ? 'Setting password...' : 'Set Password & Continue'}
				</button>
			</form>
		</div>
	{/if}
</div>
