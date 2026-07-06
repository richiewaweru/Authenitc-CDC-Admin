<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Icon from '$lib/components/Icon.svelte';

	type EventRow = (typeof data.events)[number];

	let { data, form } = $props();

	let panelOpen = $state(false);
	let editingEventId = $state('');
	let title = $state('');
	let description = $state('');
	let eventDate = $state('');
	let durationMinutes = $state('60');
	let location = $state('');
	let meetingLink = $state('');
	let coverImageUrl = $state('');
	let published = $state(false);
	let saveError = $state('');
	let submitting = $state(false);
	let actionSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);

	function toDatetimeLocal(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return '';
		}

		const offset = date.getTimezoneOffset();
		const local = new Date(date.getTime() - offset * 60_000);
		return local.toISOString().slice(0, 16);
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}

	function openCreatePanel() {
		editingEventId = '';
		title = '';
		description = '';
		eventDate = '';
		durationMinutes = '60';
		location = '';
		meetingLink = '';
		coverImageUrl = '';
		published = false;
		saveError = '';
		panelOpen = true;
	}

	function openEditPanel(event: EventRow) {
		editingEventId = event.id;
		title = event.title;
		description = event.description ?? '';
		eventDate = toDatetimeLocal(event.event_date);
		durationMinutes = `${event.duration_minutes}`;
		location = event.location ?? '';
		meetingLink = event.meeting_link ?? '';
		coverImageUrl = event.cover_image_url ?? '';
		published = event.published;
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

	const saveEnhance: SubmitFunction = () => {
		submitting = true;
		saveError = '';

		return async ({ result, update }) => {
			submitting = false;

			if (result.type === 'success') {
				await update();
				closePanel();
				showToast(result.data?.message ?? 'Event saved.');
				return;
			}

			await applyAction(result);
			saveError =
				result.type === 'failure'
					? result.data?.message ?? 'Could not save this event.'
					: 'Something went wrong while saving this event.';
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
					showToast(result.data?.message ?? 'Event updated.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not update this event.'
						: 'Something went wrong while updating this event.',
					'error'
				);
			};
		};
	}
</script>

<svelte:head>
	<title>Events | Authentic Admin</title>
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
			<h1 class="panel-title">Events</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Create and manage community gatherings members can discover from the mobile app.
			</p>
		</div>

		{#if data.canEdit}
			<button type="button" class="button-primary w-full sm:w-auto" onclick={openCreatePanel}>
				<Icon name="events" className="mr-2 h-4 w-4" />
				Create event
			</button>
		{:else}
			<div class="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-on-surface-variant">
				Guides can review events, while admins and moderators manage publishing.
			</div>
		{/if}
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Event Data Issues</p>
			{#each data.issues as issue}
				<p class="text-sm text-error-strong">{issue}</p>
			{/each}
		</div>
	{/if}

	<div class="shell-card space-y-5">
		<div class="flex flex-wrap gap-2">
			{#each ['all', 'upcoming', 'past', 'drafts'] as filter}
				<a
					href={`/events?filter=${filter}`}
					class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
						data.filter === filter ? 'bg-primary text-white' : 'bg-background text-on-surface-variant'
					}`}
				>
					{filter.charAt(0).toUpperCase() + filter.slice(1)}
				</a>
			{/each}
		</div>

		{#if data.events.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No events match this view.</p>
				<p class="mt-2 text-sm text-on-surface-variant">Create a draft event when Susan is ready to seed the calendar.</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each data.events as event}
					<div class="rounded-[24px] border border-sand bg-background p-4">
						<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
							<div class="min-w-0 space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-base font-semibold text-on-surface">{event.title}</h2>
									<span class={`badge ${event.published ? 'bg-success text-primary-dark' : 'bg-surface text-on-surface-variant'}`}>
										{event.published ? 'Published' : 'Draft'}
									</span>
								</div>
								<p class="text-sm text-on-surface-variant">{formatDate(event.event_date)}</p>
								<p class="text-sm text-on-surface-variant">
									{event.location ?? 'Location TBD'} | {event.duration_minutes} min
								</p>
								{#if event.description}
									<p class="line-clamp-2 max-w-4xl text-sm leading-7 text-on-surface-variant">{event.description}</p>
								{/if}
							</div>

							{#if data.canEdit}
								<div class="flex flex-wrap gap-2">
									<button type="button" class="button-secondary text-xs" onclick={() => openEditPanel(event)}>
										Edit
									</button>
									<form method="POST" action="?/togglePublish" use:enhance={actionEnhance(`${event.id}:publish`)}>
										<input type="hidden" name="eventId" value={event.id} />
										<input type="hidden" name="published" value={`${event.published}`} />
										<button type="submit" class="button-secondary text-xs" disabled={actionSubmitting === `${event.id}:publish`}>
											{event.published ? 'Unpublish' : 'Publish'}
										</button>
									</form>
									<form method="POST" action="?/delete" use:enhance={actionEnhance(`${event.id}:delete`, 'Delete this event?')}>
										<input type="hidden" name="eventId" value={event.id} />
										<button
											type="submit"
											class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
											disabled={actionSubmitting === `${event.id}:delete`}
										>
											Delete
										</button>
									</form>
								</div>
							{/if}
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
		aria-label="Close event panel"
		onclick={closePanel}
	></button>

	<div class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">{editingEventId ? 'Edit event' : 'Create event'}</p>
				<h2 class="panel-title">{editingEventId ? 'Update community event' : 'New community event'}</h2>
			</div>
			<button type="button" class="button-secondary" onclick={closePanel}>Close</button>
		</div>

		<form method="POST" action="?/save" class="mt-8 space-y-5" use:enhance={saveEnhance}>
			<input type="hidden" name="eventId" value={editingEventId} />

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="title">Title</label>
				<input id="title" name="title" class="input-base" bind:value={title} maxlength="120" required />
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="description">Description</label>
				<textarea id="description" name="description" class="input-base min-h-32" bind:value={description} maxlength="2000"></textarea>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="eventDate">Date and time</label>
					<input id="eventDate" name="eventDate" type="datetime-local" class="input-base" bind:value={eventDate} required />
				</div>
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="durationMinutes">Duration</label>
					<input id="durationMinutes" name="durationMinutes" type="number" min="1" class="input-base" bind:value={durationMinutes} required />
				</div>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="location">Location</label>
				<input id="location" name="location" class="input-base" bind:value={location} maxlength="200" placeholder="Virtual or Grace Church Hall" />
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="meetingLink">Meeting link</label>
				<input id="meetingLink" name="meetingLink" type="url" class="input-base" bind:value={meetingLink} placeholder="https://..." />
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="coverImageUrl">Cover image URL</label>
				<input id="coverImageUrl" name="coverImageUrl" type="url" class="input-base" bind:value={coverImageUrl} placeholder="https://..." />
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
					{submitting ? 'Saving...' : 'Save event'}
				</button>
			</div>
		</form>
	</div>
{/if}
