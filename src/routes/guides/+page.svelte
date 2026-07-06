<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	type GuideRow = (typeof data.guides)[number];

	let { data, form } = $props();

	let panelOpen = $state(false);
	let editingGuideId = $state('');
	let displayName = $state('');
	let title = $state('Community Guide');
	let email = $state('');
	let avatarUrl = $state('');
	let bio = $state('');
	let isActive = $state(true);
	let saveError = $state('');
	let deleteError = $state('');
	let saveSubmitting = $state(false);
	let deleteSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);

	function openCreatePanel() {
		editingGuideId = '';
		displayName = '';
		title = 'Community Guide';
		email = '';
		avatarUrl = '';
		bio = '';
		isActive = true;
		saveError = '';
		panelOpen = true;
	}

	function openEditPanel(guide: GuideRow) {
		editingGuideId = guide.id;
		displayName = guide.display_name ?? guide.name ?? '';
		title = guide.title ?? 'Community Guide';
		email = guide.email ?? '';
		avatarUrl = guide.avatar_url ?? '';
		bio = guide.bio ?? '';
		isActive = guide.is_active;
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

	function accountStateLabel(state: GuideRow['accountState']) {
		if (state === 'linked') {
			return 'Linked account';
		}

		if (state === 'pending_setup') {
			return 'Pending setup';
		}

		return 'Profile only';
	}

	function accountStateTone(state: GuideRow['accountState']) {
		if (state === 'linked') {
			return 'bg-success text-primary-dark';
		}

		if (state === 'pending_setup') {
			return 'bg-warning/55 text-[#664D03]';
		}

		return 'bg-background text-on-surface-variant';
	}

	const saveGuideEnhance: SubmitFunction = () => {
		saveSubmitting = true;
		saveError = '';

		return async ({ result, update }) => {
			saveSubmitting = false;

			if (result.type === 'success') {
				await update();
				closePanel();
				showToast(result.data?.message ?? 'Guide saved.');
				return;
			}

			await applyAction(result);

			if (result.type === 'failure') {
				saveError = result.data?.message ?? 'Could not save this guide.';
			} else if (result.type === 'error') {
				saveError = 'Something went wrong while saving this guide.';
			}
		};
	};

	function deleteGuideEnhance(guideId: string): SubmitFunction {
		return ({ cancel }) => {
			const approved = confirm('Delete this guide? Their open and booked slots will be removed as well.');

			if (!approved) {
				cancel();
				return;
			}

			deleteSubmitting = guideId;
			deleteError = '';

			return async ({ result, update }) => {
				deleteSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Guide removed.');
					return;
				}

				await applyAction(result);
				deleteError = result.type === 'failure'
					? result.data?.message ?? 'Could not delete this guide.'
					: 'Something went wrong while deleting this guide.';
				showToast(deleteError, 'error');
			};
		};
	}
</script>

<svelte:head>
	<title>Guides | Authentic Admin</title>
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
			<p class="section-eyebrow">Milestone 3</p>
			<h1 class="panel-title">Guides</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Manage active guides, keep their public profile details clean, and track whether each guide is
				fully linked to a staff account yet.
			</p>
		</div>

		{#if data.role === 'admin'}
			<button type="button" class="button-primary w-full sm:w-auto" onclick={openCreatePanel}>
				<Icon name="guides" className="mr-2 h-4 w-4" />
				Invite guide
			</button>
		{:else}
			<div class="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-on-surface-variant">
				Moderators can edit guide profiles, while admins send new guide invites.
			</div>
		{/if}
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Guide Data Issues</p>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 xl:grid-cols-3">
		<div class="shell-card space-y-3">
			<p class="section-eyebrow">Top Performer</p>
			{#if data.summary.topPerformer}
				<div class="flex items-center gap-4">
					<Avatar
						initials={data.summary.topPerformer.initials}
						name={data.summary.topPerformer.label}
						size="lg"
					/>
					<div class="space-y-1">
						<p class="text-lg font-semibold text-on-surface">{data.summary.topPerformer.label}</p>
						<p class="text-sm text-on-surface-variant">
							{data.summary.topPerformer.completedSlots} completed slots
						</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-on-surface-variant">No guide slot history is available yet.</p>
			{/if}
		</div>

		<div class="shell-card space-y-3">
			<p class="section-eyebrow">Capacity Overview</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.capacityPercent}%</p>
			<p class="text-sm text-on-surface-variant">
				{data.summary.bookedSlots} booked out of {data.summary.totalTrackedSlots} tracked slots across the
				current guide roster.
			</p>
			<div class="h-2 overflow-hidden rounded-full bg-background">
				<div
					class="h-full rounded-full bg-primary"
					style={`width: ${Math.max(8, data.summary.capacityPercent)}%`}
				></div>
			</div>
		</div>

		<div class="shell-card grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
			<div>
				<p class="section-eyebrow">Total Guides</p>
				<p class="mt-2 font-display text-3xl font-semibold text-on-surface">{data.summary.totalGuides}</p>
			</div>
			<div>
				<p class="section-eyebrow">Active</p>
				<p class="mt-2 font-display text-3xl font-semibold text-on-surface">{data.summary.activeGuides}</p>
			</div>
			<div>
				<p class="section-eyebrow">Pending Setup</p>
				<p class="mt-2 font-display text-3xl font-semibold text-on-surface">
					{data.summary.pendingSetups}
				</p>
			</div>
		</div>
	</div>

	<div class="shell-card space-y-5">
		<form method="GET" class="grid gap-3 lg:grid-cols-[180px_1fr_auto] lg:items-center">
			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="status">Status</label>
				<select id="status" name="status" class="input-base">
					<option value="all" selected={data.filters.status === 'all'}>All guides</option>
					<option value="active" selected={data.filters.status === 'active'}>Active only</option>
					<option value="inactive" selected={data.filters.status === 'inactive'}>Inactive only</option>
				</select>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="search">Search</label>
				<div class="relative">
					<Icon
						name="search"
						className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
					/>
					<input
						id="search"
						name="search"
						type="search"
						value={data.filters.search}
						class="input-base pl-11"
						placeholder="Search guides by name, title, or email"
					/>
				</div>
			</div>

			<div class="flex gap-3 pt-6 lg:justify-end">
				<button type="submit" class="button-primary">Apply</button>
				<a href="/guides" class="button-secondary">Reset</a>
			</div>
		</form>

		{#if deleteError}
			<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
				{deleteError}
			</div>
		{/if}

		{#if data.guides.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No guides match these filters.</p>
				<p class="mt-2 text-sm text-on-surface-variant">
					Try a different search, or have an admin invite the first guide to start managing availability.
				</p>
			</div>
		{:else}
			<div class="space-y-4 md:hidden">
				{#each data.guides as guide}
					<div class="rounded-[24px] border border-sand bg-background px-4 py-4">
						<div class="flex items-start gap-4">
							<Avatar
								initials={guide.initials ?? guide.label.slice(0, 2).toUpperCase()}
								name={guide.label}
								src={guide.avatar_url}
							/>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold text-on-surface">{guide.label}</p>
									<span class={`badge ${accountStateTone(guide.accountState)}`}>
										{accountStateLabel(guide.accountState)}
									</span>
								</div>
								<p class="text-sm text-on-surface-variant">{guide.email ?? 'No email yet'}</p>
								<p class="text-sm text-on-surface-variant">{guide.title ?? 'Community Guide'}</p>
								<div class="flex flex-wrap gap-2">
									<span class={`badge ${guide.is_active ? 'bg-success text-primary-dark' : 'bg-background text-on-surface-variant'}`}>
										{guide.is_active ? 'Active' : 'Inactive'}
									</span>
									<span class="badge bg-background text-on-surface-variant">{guide.openSlots} open</span>
									<span class="badge bg-background text-on-surface-variant">
										{guide.completedSlots} completed
									</span>
								</div>
								<div class="flex flex-wrap gap-2 pt-1">
									<button
										type="button"
										class="button-secondary text-xs"
										onclick={() => openEditPanel(guide)}
									>
										Edit
									</button>

									{#if data.role === 'admin'}
										<form
											method="POST"
											action="?/deleteGuide"
											use:enhance={deleteGuideEnhance(guide.id)}
										>
											<input type="hidden" name="guideId" value={guide.id} />
											<button
												type="submit"
												class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
												disabled={deleteSubmitting === guide.id}
											>
												{deleteSubmitting === guide.id ? 'Removing...' : 'Delete'}
											</button>
										</form>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="hidden overflow-x-auto md:block">
				<table class="min-w-full border-separate border-spacing-0">
					<thead>
						<tr class="text-left">
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Guide Details
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Professional Title
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Status
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Open Slots
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{#each data.guides as guide}
							<tr class="align-top">
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="flex items-start gap-4">
										<Avatar
											initials={guide.initials ?? guide.label.slice(0, 2).toUpperCase()}
											name={guide.label}
											src={guide.avatar_url}
										/>
										<div class="min-w-0 space-y-1">
											<p class="text-sm font-semibold text-on-surface">{guide.label}</p>
											<p class="text-sm text-on-surface-variant">{guide.email ?? 'No email yet'}</p>
											<span class={`badge ${accountStateTone(guide.accountState)}`}>
												{accountStateLabel(guide.accountState)}
											</span>
										</div>
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface-variant">
									{guide.title ?? 'Community Guide'}
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<span class={`badge ${guide.is_active ? 'bg-success text-primary-dark' : 'bg-background text-on-surface-variant'}`}>
										{guide.is_active ? 'Active' : 'Inactive'}
									</span>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="space-y-1">
										<p class="text-sm font-semibold text-on-surface">{guide.openSlots}</p>
										<p class="text-xs text-on-surface-variant">
											{guide.completedSlots} completed sessions
										</p>
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="flex flex-wrap gap-2">
										<button
											type="button"
											class="button-secondary text-xs"
											onclick={() => openEditPanel(guide)}
										>
											Edit
										</button>

										{#if data.role === 'admin'}
											<form
												method="POST"
												action="?/deleteGuide"
												use:enhance={deleteGuideEnhance(guide.id)}
											>
												<input type="hidden" name="guideId" value={guide.id} />
												<button
													type="submit"
													class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
													disabled={deleteSubmitting === guide.id}
												>
													{deleteSubmitting === guide.id ? 'Removing...' : 'Delete'}
												</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm text-on-surface-variant">
				Page {data.pagination.page} of {data.pagination.totalPages} | {data.pagination.totalCount} guides
			</p>

			<div class="flex gap-3">
				{#if data.pagination.page > 1}
					<a
						class="button-secondary"
						href={`/guides?status=${data.filters.status}&search=${encodeURIComponent(data.filters.search)}&page=${data.pagination.page - 1}`}
					>
						Previous
					</a>
				{/if}

				{#if data.pagination.page < data.pagination.totalPages}
					<a
						class="button-secondary"
						href={`/guides?status=${data.filters.status}&search=${encodeURIComponent(data.filters.search)}&page=${data.pagination.page + 1}`}
					>
						Next
					</a>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if panelOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		onclick={closePanel}
		onkeydown={(event) => event.key === 'Escape' && closePanel()}
	></div>

	<div class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">{editingGuideId ? 'Edit guide' : 'Add guide'}</p>
				<h2 class="panel-title">{editingGuideId ? 'Update guide profile' : 'Create a new guide profile'}</h2>
				<p class="text-sm leading-7 text-on-surface-variant">
					For brand-new guides, use their email so the invite flow can create the linked auth account.
					Existing guide profiles can still be edited here without changing the invite state.
				</p>
			</div>

			<button type="button" class="button-secondary" onclick={closePanel}>Close</button>
		</div>

		<form
			method="POST"
			action="?/saveGuide"
			class="mt-8 space-y-5"
			use:enhance={saveGuideEnhance}
		>
			<input type="hidden" name="guideId" value={editingGuideId} />

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="displayName">Name</label>
				<input
					id="displayName"
					name="displayName"
					class="input-base"
					bind:value={displayName}
					placeholder="Sarah Jenkins"
					required
				/>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="title">Title</label>
				<input
					id="title"
					name="title"
					class="input-base"
					bind:value={title}
					placeholder="Community Guide"
				/>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					class="input-base"
					bind:value={email}
					placeholder="guide@example.com"
				/>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="avatarUrl">Avatar URL</label>
				<input
					id="avatarUrl"
					name="avatarUrl"
					class="input-base"
					bind:value={avatarUrl}
					placeholder="https://..."
				/>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-3">
					<label class="text-sm font-semibold text-on-surface" for="bio">Community Bio</label>
					<span class="text-xs text-on-surface-variant">{bio.length}/600</span>
				</div>
				<textarea
					id="bio"
					name="bio"
					class="input-base min-h-32"
					bind:value={bio}
					maxlength="600"
					placeholder="A short public bio members will see in Guide Corner"
				></textarea>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="space-y-1">
						<p class="text-sm font-semibold text-on-surface">Active status</p>
						<p class="text-sm text-on-surface-variant">
							Inactive guides stay in the roster but drop out of the active directory.
						</p>
					</div>

					<label class="inline-flex items-center gap-3 text-sm font-semibold text-on-surface">
						<input type="checkbox" name="isActive" bind:checked={isActive} class="accent-primary" />
						<span>{isActive ? 'Active' : 'Inactive'}</span>
					</label>
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Preview</p>
				<div class="mt-4 flex items-center gap-4">
					<Avatar
						initials={displayName
							.split(/\s+/)
							.filter(Boolean)
							.slice(0, 2)
							.map((part) => part.charAt(0).toUpperCase())
							.join('') || 'G'}
						name={displayName || 'Guide preview'}
						src={avatarUrl || null}
						size="lg"
					/>
					<div class="space-y-1">
						<p class="text-sm font-semibold text-on-surface">{displayName || 'Guide preview'}</p>
						<p class="text-sm text-on-surface-variant">{title || 'Community Guide'}</p>
						<p class="text-xs text-on-surface-variant">{email || 'No email yet'}</p>
						{#if bio}
							<p class="max-w-sm text-xs leading-5 text-on-surface-variant">{bio}</p>
						{/if}
					</div>
				</div>
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
				<button type="submit" class="button-primary" disabled={saveSubmitting}>
					{saveSubmitting ? 'Saving...' : editingGuideId ? 'Save changes' : 'Send invite'}
				</button>
			</div>
		</form>
	</div>
{/if}
