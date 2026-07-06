<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Icon from '$lib/components/Icon.svelte';

	type AnnouncementRow = (typeof data.announcements)[number];

	let { data, form } = $props();

	let panelOpen = $state(false);
	let editingAnnouncementId = $state('');
	let title = $state('');
	let body = $state('');
	let tone = $state('info');
	let pinned = $state(false);
	let published = $state(false);
	let expiresAt = $state('');
	let saveError = $state('');
	let submitting = $state(false);
	let actionSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);
	let bodyCount = $derived(body.length);

	function formatDate(value: string | null) {
		if (!value) {
			return 'No expiry';
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));
	}

	function toDateInput(value: string | null) {
		if (!value) {
			return '';
		}

		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
	}

	function isExpired(announcement: AnnouncementRow) {
		return announcement.expires_at ? new Date(announcement.expires_at) <= new Date() : false;
	}

	function toneClass(value: AnnouncementRow['tone'] | string) {
		switch (value) {
			case 'celebration':
				return 'bg-warning/55 text-[#664D03]';
			case 'reminder':
				return 'bg-[#FFE5C2] text-[#7A3E00]';
			case 'alert':
				return 'bg-error text-error-strong';
			default:
				return 'bg-success text-primary-dark';
		}
	}

	function openCreatePanel() {
		editingAnnouncementId = '';
		title = '';
		body = '';
		tone = 'info';
		pinned = false;
		published = false;
		expiresAt = '';
		saveError = '';
		panelOpen = true;
	}

	function openEditPanel(announcement: AnnouncementRow) {
		editingAnnouncementId = announcement.id;
		title = announcement.title;
		body = announcement.body;
		tone = announcement.tone;
		pinned = announcement.pinned;
		published = announcement.published;
		expiresAt = toDateInput(announcement.expires_at);
		saveError = '';
		panelOpen = true;
	}

	function closePanel() {
		panelOpen = false;
		saveError = '';
	}

	function showToast(message: string, nextTone: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastTone = nextTone;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	const saveEnhance: SubmitFunction = () => {
		submitting = true;
		saveError = '';

		return async ({ result, update }) => {
			submitting = false;

			if (result.type === 'success') {
				await update();
				closePanel();
				showToast(result.data?.message ?? 'Announcement saved.');
				return;
			}

			await applyAction(result);
			saveError =
				result.type === 'failure'
					? result.data?.message ?? 'Could not save this announcement.'
					: 'Something went wrong while saving this announcement.';
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
					showToast(result.data?.message ?? 'Announcement updated.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not update this announcement.'
						: 'Something went wrong while updating this announcement.',
					'error'
				);
			};
		};
	}
</script>

<svelte:head>
	<title>Announcements | Authentic Admin</title>
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
			<h1 class="panel-title">Announcements</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Publish short community notices that appear at the top of the member Home tab.
			</p>
		</div>

		<button type="button" class="button-primary w-full sm:w-auto" onclick={openCreatePanel}>
			<Icon name="announcements" className="mr-2 h-4 w-4" />
			New announcement
		</button>
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Announcement Data Issues</p>
			{#each data.issues as issue}
				<p class="text-sm text-error-strong">{issue}</p>
			{/each}
		</div>
	{/if}

	<div class="shell-card space-y-4">
		{#if data.announcements.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No announcements yet.</p>
				<p class="mt-2 text-sm text-on-surface-variant">Create a welcome announcement to make the Home tab feel alive on day one.</p>
			</div>
		{:else}
			{#each data.announcements as announcement}
				<div class={`rounded-[24px] border border-sand bg-background p-4 ${isExpired(announcement) ? 'opacity-60' : ''}`}>
					<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div class="min-w-0 space-y-2">
							<div class="flex flex-wrap items-center gap-2">
								<span class={`badge ${toneClass(announcement.tone)}`}>{announcement.tone}</span>
								<span class={`badge ${announcement.published ? 'bg-success text-primary-dark' : 'bg-surface text-on-surface-variant'}`}>
									{announcement.published ? 'Published' : 'Draft'}
								</span>
								{#if announcement.pinned}
									<span class="badge bg-primary text-white">Pinned</span>
								{/if}
								{#if isExpired(announcement)}
									<span class="badge bg-background text-on-surface-variant">Expired</span>
								{/if}
							</div>
							<h2 class="text-base font-semibold text-on-surface">{announcement.title}</h2>
							<p class="max-w-4xl text-sm leading-7 text-on-surface-variant">{announcement.body}</p>
							<p class="text-xs text-on-surface-variant">Expires: {formatDate(announcement.expires_at)}</p>
						</div>

						<div class="flex flex-wrap gap-2">
							<button type="button" class="button-secondary text-xs" onclick={() => openEditPanel(announcement)}>
								Edit
							</button>
							<form method="POST" action="?/togglePin" use:enhance={actionEnhance(`${announcement.id}:pin`)}>
								<input type="hidden" name="announcementId" value={announcement.id} />
								<input type="hidden" name="pinned" value={`${announcement.pinned}`} />
								<button type="submit" class="button-secondary text-xs" disabled={actionSubmitting === `${announcement.id}:pin`}>
									{announcement.pinned ? 'Unpin' : 'Pin'}
								</button>
							</form>
							<form method="POST" action="?/togglePublish" use:enhance={actionEnhance(`${announcement.id}:publish`)}>
								<input type="hidden" name="announcementId" value={announcement.id} />
								<input type="hidden" name="published" value={`${announcement.published}`} />
								<button type="submit" class="button-secondary text-xs" disabled={actionSubmitting === `${announcement.id}:publish`}>
									{announcement.published ? 'Unpublish' : 'Publish'}
								</button>
							</form>
							<form method="POST" action="?/delete" use:enhance={actionEnhance(`${announcement.id}:delete`, 'Delete this announcement?')}>
								<input type="hidden" name="announcementId" value={announcement.id} />
								<button
									type="submit"
									class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
									disabled={actionSubmitting === `${announcement.id}:delete`}
								>
									Delete
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</section>

{#if panelOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		aria-label="Close announcement panel"
		onclick={closePanel}
	></button>

	<div class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">{editingAnnouncementId ? 'Edit announcement' : 'New announcement'}</p>
				<h2 class="panel-title">{editingAnnouncementId ? 'Update notice' : 'Create notice'}</h2>
			</div>
			<button type="button" class="button-secondary" onclick={closePanel}>Close</button>
		</div>

		<form method="POST" action="?/save" class="mt-8 space-y-5" use:enhance={saveEnhance}>
			<input type="hidden" name="announcementId" value={editingAnnouncementId} />

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="title">Title</label>
				<input id="title" name="title" class="input-base" bind:value={title} maxlength="100" required />
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-3">
					<label class="text-sm font-semibold text-on-surface" for="body">Body</label>
					<span class="text-xs text-on-surface-variant">{bodyCount}/500</span>
				</div>
				<textarea id="body" name="body" class="input-base min-h-32" bind:value={body} maxlength="500" required></textarea>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="tone">Tone</label>
				<select id="tone" name="tone" class="input-base" bind:value={tone}>
					{#each data.tones as toneOption}
						<option value={toneOption}>{toneOption.charAt(0).toUpperCase() + toneOption.slice(1)}</option>
					{/each}
				</select>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex items-center justify-between gap-4 rounded-[24px] border border-sand bg-background p-4 text-sm font-semibold text-on-surface">
					<span>Pinned</span>
					<input type="checkbox" name="pinned" bind:checked={pinned} class="accent-primary" />
				</label>
				<label class="flex items-center justify-between gap-4 rounded-[24px] border border-sand bg-background p-4 text-sm font-semibold text-on-surface">
					<span>Published</span>
					<input type="checkbox" name="published" bind:checked={published} class="accent-primary" />
				</label>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="expiresAt">Expires at</label>
				<input id="expiresAt" name="expiresAt" type="date" class="input-base" bind:value={expiresAt} />
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

			<div class="flex justify-end gap-3 pt-2">
				<button type="button" class="button-secondary" onclick={closePanel}>Cancel</button>
				<button type="submit" class="button-primary" disabled={submitting}>
					{submitting ? 'Saving...' : 'Save announcement'}
				</button>
			</div>
		</form>
	</div>
{/if}
