<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Icon from '$lib/components/Icon.svelte';

	type ReadingRow = (typeof data.readings)[number];

	let { data, form } = $props();

	let panelOpen = $state(false);
	let editingReadingId = $state('');
	let title = $state('');
	let category = $state('General');
	let body = $state('');
	let externalUrl = $state('');
	let published = $state(false);
	let saveError = $state('');
	let submitting = $state(false);
	let actionSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);
	let bodyCount = $derived(body.length);
	const statusOptions = ['all', 'published', 'drafts'] as const;

	function formatDate(value: string | null) {
		if (!value) {
			return 'Not published';
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));
	}

	function previewBody(value: string | null) {
		if (!value) {
			return 'External reading';
		}

		return value.length > 140 ? `${value.slice(0, 140)}...` : value;
	}

	function openCreatePanel() {
		editingReadingId = '';
		title = '';
		category = 'General';
		body = '';
		externalUrl = '';
		published = false;
		saveError = '';
		panelOpen = true;
	}

	function openEditPanel(reading: ReadingRow) {
		editingReadingId = reading.id;
		title = reading.title;
		category = reading.category;
		body = reading.body ?? '';
		externalUrl = reading.external_url ?? '';
		published = reading.published;
		saveError = '';
		panelOpen = true;
	}

	function closePanel() {
		panelOpen = false;
		saveError = '';
	}

	function showToast(message: string, tone: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastTone = tone;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	function buildHref(nextStatus = data.status, nextCategory: string | null = data.category) {
		const params = new URLSearchParams();
		params.set('status', nextStatus);
		if (nextCategory) {
			params.set('category', nextCategory);
		}
		return `/readings?${params.toString()}`;
	}

	const saveEnhance: SubmitFunction = () => {
		submitting = true;
		saveError = '';

		return async ({ result, update }) => {
			submitting = false;

			if (result.type === 'success') {
				await update();
				closePanel();
				showToast(result.data?.message ?? 'Reading saved.');
				return;
			}

			await applyAction(result);
			saveError =
				result.type === 'failure'
					? result.data?.message ?? 'Could not save this reading.'
					: 'Something went wrong while saving this reading.';
		};
	};

	function actionEnhance(key: string, confirmMessage?: string): SubmitFunction {
		return ({ cancel }) => {
			if (confirmMessage && !confirm(confirmMessage)) {
				cancel();
				return;
			}

			actionSubmitting = key;

			return async ({ result, update }) => {
				actionSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Reading updated.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not update this reading.'
						: 'Something went wrong while updating this reading.',
					'error'
				);
			};
		};
	}
</script>

<svelte:head>
	<title>Readings | Authentic Admin</title>
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
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div class="space-y-2">
			<p class="section-eyebrow">Community</p>
			<h1 class="panel-title">Readings</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Publish Foundations content for members to read inside the community app.
			</p>
		</div>

		<button type="button" class="button-primary w-full sm:w-auto" onclick={openCreatePanel}>
			<Icon name="readings" className="mr-2 h-4 w-4" />
			New reading
		</button>
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Reading Data Issues</p>
			{#each data.issues as issue}
				<p class="text-sm text-error-strong">{issue}</p>
			{/each}
		</div>
	{/if}

	<div class="shell-card space-y-5">
		<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
			<div class="flex flex-wrap gap-2">
				{#each statusOptions as status}
					<a
						href={buildHref(status)}
						class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
							data.status === status ? 'bg-primary text-white' : 'bg-background text-on-surface-variant'
						}`}
					>
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</a>
				{/each}
			</div>

			<div class="flex flex-wrap gap-2">
				<a
					href={buildHref(data.status, null)}
					class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
						!data.category ? 'bg-primary text-white' : 'bg-background text-on-surface-variant'
					}`}
				>
					All categories
				</a>
				{#each data.categories as categoryOption}
					<a
						href={buildHref(data.status, categoryOption)}
						class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
							data.category === categoryOption ? 'bg-primary text-white' : 'bg-background text-on-surface-variant'
						}`}
					>
						{categoryOption}
					</a>
				{/each}
			</div>
		</div>

		{#if data.readings.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No readings match this view.</p>
				<p class="mt-2 text-sm text-on-surface-variant">Draft a short Foundation piece to give the tab real substance.</p>
			</div>
		{:else}
			<div class="grid gap-4 xl:grid-cols-2">
				{#each data.readings as reading}
					<div class="rounded-[24px] border border-sand bg-background p-4">
						<div class="space-y-3">
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge bg-primary/10 text-primary-dark">{reading.category}</span>
								<span class={`badge ${reading.published ? 'bg-success text-primary-dark' : 'bg-surface text-on-surface-variant'}`}>
									{reading.published ? 'Published' : 'Draft'}
								</span>
								<span class="text-xs text-on-surface-variant">{formatDate(reading.published_at)}</span>
							</div>
							<h2 class="text-base font-semibold text-on-surface">{reading.title}</h2>
							<p class="text-sm leading-7 text-on-surface-variant">{previewBody(reading.body)}</p>
							<div class="flex flex-wrap gap-2 pt-1">
								<button type="button" class="button-secondary text-xs" onclick={() => openEditPanel(reading)}>
									Edit
								</button>
								<form method="POST" action="?/togglePublish" use:enhance={actionEnhance(`${reading.id}:publish`)}>
									<input type="hidden" name="readingId" value={reading.id} />
									<input type="hidden" name="published" value={`${reading.published}`} />
									<button type="submit" class="button-secondary text-xs" disabled={actionSubmitting === `${reading.id}:publish`}>
										{reading.published ? 'Unpublish' : 'Publish'}
									</button>
								</form>
								<form method="POST" action="?/delete" use:enhance={actionEnhance(`${reading.id}:delete`, 'Delete this reading?')}>
									<input type="hidden" name="readingId" value={reading.id} />
									<button
										type="submit"
										class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
										disabled={actionSubmitting === `${reading.id}:delete`}
									>
										Delete
									</button>
								</form>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

{#if panelOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		aria-label="Close reading panel"
		onclick={closePanel}
	></button>

	<div class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">{editingReadingId ? 'Edit reading' : 'New reading'}</p>
				<h2 class="panel-title">{editingReadingId ? 'Update Foundation piece' : 'Create Foundation piece'}</h2>
			</div>
			<button type="button" class="button-secondary" onclick={closePanel}>Close</button>
		</div>

		<form method="POST" action="?/save" class="mt-8 space-y-5" use:enhance={saveEnhance}>
			<input type="hidden" name="readingId" value={editingReadingId} />

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="title">Title</label>
				<input id="title" name="title" class="input-base" bind:value={title} maxlength="120" required />
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="category">Category</label>
				<select id="category" name="category" class="input-base" bind:value={category}>
					{#each data.categories as categoryOption}
						<option value={categoryOption}>{categoryOption}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-3">
					<label class="text-sm font-semibold text-on-surface" for="body">Body</label>
					<span class="text-xs text-on-surface-variant">{bodyCount}/10000</span>
				</div>
				<textarea id="body" name="body" class="input-base min-h-72" bind:value={body} maxlength="10000"></textarea>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="externalUrl">External URL</label>
				<input id="externalUrl" name="externalUrl" type="url" class="input-base" bind:value={externalUrl} placeholder="https://..." />
			</div>

			<label class="flex items-center justify-between gap-4 rounded-[24px] border border-sand bg-background p-4 text-sm font-semibold text-on-surface">
				<span>Published</span>
				<input type="checkbox" name="published" bind:checked={published} class="accent-primary" />
			</label>

			{#if saveError}
				<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
					{saveError}
				</div>
			{:else if form?.message}
				<div class="rounded-3xl border border-sand bg-background px-4 py-3 text-sm text-on-surface-variant">
					{form.message}
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<button type="button" class="button-secondary" onclick={closePanel}>Cancel</button>
				<button type="submit" class="button-primary" disabled={submitting}>
					{submitting ? 'Saving...' : 'Save reading'}
				</button>
			</div>
		</form>
	</div>
{/if}
