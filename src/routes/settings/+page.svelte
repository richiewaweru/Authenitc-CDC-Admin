<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Avatar from '$lib/components/Avatar.svelte';

	let { data, form } = $props();

	let bio = $state('');
	let loadedGuideId = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state('');
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);

	$effect(() => {
		const nextGuideId = data.guide?.id ?? null;

		if (nextGuideId !== loadedGuideId) {
			bio = data.guide?.bio ?? '';
			loadedGuideId = nextGuideId;
		}
	});

	function showToast(message: string, tone: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastTone = tone;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	const saveBioEnhance: SubmitFunction = () => {
		saving = true;
		saveError = '';

		return async ({ result, update }) => {
			saving = false;

			if (result.type === 'success') {
				await update();
				showToast(result.data?.message ?? 'Community bio saved.');
				return;
			}

			await applyAction(result);
			saveError =
				result.type === 'failure'
					? result.data?.message ?? 'Could not save your community bio.'
					: 'Something went wrong while saving your community bio.';
			showToast(saveError, 'error');
		};
	};
</script>

<svelte:head>
	<title>Settings | Authentic Admin</title>
</svelte:head>

{#if toastVisible}
	<div
		class={`fixed right-4 top-4 z-50 max-w-sm rounded-2xl border px-5 py-3 text-sm font-medium shadow-lg ${
			toastTone === 'success'
				? 'border-green-200 bg-success text-primary-dark'
				: 'border-red-200 bg-error text-error-strong'
		}`}
	>
		{toastMessage}
	</div>
{/if}

<section class="space-y-8">
	<div class="space-y-2">
		<p class="section-eyebrow">Staff</p>
		<h1 class="panel-title">Settings</h1>
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
			Manage your staff-facing profile settings and the public guide details members see in the
			community app.
		</p>
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Settings Data Issues</p>
			{#each data.issues as issue}
				<p class="text-sm text-error-strong">{issue}</p>
			{/each}
		</div>
	{/if}

	<div class="shell-card space-y-5">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div class="space-y-2">
				<p class="section-eyebrow">Guide Corner</p>
				<h2 class="font-display text-2xl font-semibold text-on-surface">Community Bio</h2>
				<p class="max-w-2xl text-sm leading-7 text-on-surface-variant">
					This bio appears in the member app Profile tab under Your Guide.
				</p>
			</div>

			{#if data.guide}
				<div class="flex items-center gap-4 rounded-[24px] border border-sand bg-background px-4 py-3">
					<Avatar
						initials={data.guide.initials ?? (data.guide.display_name ?? data.guide.name ?? 'G').slice(0, 2).toUpperCase()}
						name={data.guide.display_name ?? data.guide.name ?? 'Guide'}
						src={data.guide.avatar_url}
					/>
					<div>
						<p class="text-sm font-semibold text-on-surface">
							{data.guide.display_name ?? data.guide.name ?? 'Guide profile'}
						</p>
						<p class="text-sm text-on-surface-variant">{data.guide.title ?? 'Community Guide'}</p>
					</div>
				</div>
			{/if}
		</div>

		{#if data.guide}
			<form method="POST" action="?/saveGuideBio" class="space-y-4" use:enhance={saveBioEnhance}>
				<div class="space-y-2">
					<div class="flex items-center justify-between gap-3">
						<label class="text-sm font-semibold text-on-surface" for="bio">Community Bio</label>
						<span class="text-xs text-on-surface-variant">{bio.length}/600</span>
					</div>
					<textarea
						id="bio"
						name="bio"
						class="input-base min-h-40"
						bind:value={bio}
						maxlength="600"
						placeholder="Share a short welcome, background, or note of encouragement for community members."
					></textarea>
				</div>

				{#if saveError}
					<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
						{saveError}
					</div>
				{:else if form?.message}
					<div class="rounded-3xl border border-sand bg-background px-4 py-3 text-sm text-on-surface-variant">
						{form.message}
					</div>
				{/if}

				<div class="flex justify-end">
					<button type="submit" class="button-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save community bio'}
					</button>
				</div>
			</form>
		{:else}
			<div class="rounded-[24px] border border-sand bg-background p-5 text-sm leading-7 text-on-surface-variant">
				Your staff account is not linked to a guide profile yet. Once an admin links your account,
				your Community Bio editor will appear here.
			</div>
		{/if}
	</div>
</section>
