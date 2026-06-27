<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	type CalendarRow = (typeof data.calendarRows)[number];
	type ListSlot = (typeof data.listSlots)[number];
	type CrossGuideAction = 'cancel' | 'reopen' | 'delete' | 'update';

	let { data, form } = $props();

	let publishModalOpen = $state(false);
	let publishError = $state('');
	let publishSubmitting = $state(false);
	let slotActionSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastTone = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);
	let publishGuideId = $state('');
	let publishForOther = $state(false);
	let publishStartDate = $state('');
	let publishEndDate = $state('');
	let publishDuration = $state('30');
	let selectedTimes = $state<string[]>([]);
	let customTime = $state('');
	let excludeWeekends = $state(true);
	let crossGuideConfirm = $state<{
		action: CrossGuideAction;
		slotId: string;
		guideLabel: string;
		formData: FormData;
		submit: () => void;
	} | null>(null);
	let confirmedCrossGuideActionKey = $state<string | null>(null);
	let guidePublishUnavailable = $derived(Boolean(data.publishDisabledReason));
	let ownGuide = $derived(data.guides.find((guide) => guide.id === data.myGuideId) ?? null);
	let otherGuides = $derived(data.guides.filter((guide) => guide.id !== data.myGuideId));

	function buildHref(week: string, view = data.filters.view, guide = data.filters.guide) {
		const params = new URLSearchParams();
		params.set('week', week);
		params.set('view', view);

		if (data.role !== 'guide' && guide !== 'all') {
			params.set('guide', guide);
		}

		return `/slots?${params.toString()}`;
	}

	function buildResetHref() {
		const params = new URLSearchParams();
		params.set('week', data.week.start);
		params.set('view', data.filters.view);
		return `/slots?${params.toString()}`;
	}

	function formatSlotDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		}).format(new Date(`${value}T00:00:00`));
	}

	function statusLabel(status: ListSlot['status']) {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	function statusToneClass(tone: ListSlot['statusTone']) {
		switch (tone) {
			case 'warning':
				return 'bg-warning/55 text-[#664D03]';
			case 'info':
				return 'bg-[#DCE8FF] text-[#214D9C]';
			case 'danger':
				return 'bg-error text-error-strong';
			default:
				return 'bg-success text-primary-dark';
		}
	}

	function defaultSelectedTimes() {
		return data.timeOptions.slice(0, 3).map((option) => option.value);
	}

	function showGuideNames() {
		return data.role !== 'guide' && data.filters.guide === 'all';
	}

	function shouldShowGuideTag(slot: ListSlot) {
		return !slot.isOwnSlot && data.filters.guide !== data.myGuideId;
	}

	function buildCrossGuideActionKey(slotId: string, loadingLabel: string) {
		return `${slotId}:${loadingLabel}`;
	}

	function describeCrossGuideAction(action: CrossGuideAction) {
		switch (action) {
			case 'cancel':
				return 'cancel';
			case 'reopen':
				return 'reopen';
			case 'delete':
				return 'delete';
			default:
				return 'update';
		}
	}

	function resolvePublishGuideId() {
		return publishForOther ? publishGuideId : (data.myGuideId ?? '');
	}

	function resetPublishForm() {
		publishForOther = false;
		publishGuideId = otherGuides[0]?.id ?? '';
		publishStartDate = data.week.start;
		publishEndDate = data.week.end;
		publishDuration = '30';
		selectedTimes = defaultSelectedTimes();
		customTime = '';
		excludeWeekends = true;
	}

	function openPublishModal() {
		if (guidePublishUnavailable) {
			return;
		}

		resetPublishForm();
		publishError = '';
		publishModalOpen = true;
	}

	function closePublishModal() {
		publishModalOpen = false;
		publishError = '';
		publishForOther = false;
	}

	function canMutateSlot(slot: ListSlot) {
		return data.canPublish && (slot.status === 'open' || slot.status === 'cancelled');
	}

	function showToast(message: string, tone: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastTone = tone;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	function publishPreviewCount() {
		if (!publishStartDate || !publishEndDate) {
			return 0;
		}

		const start = new Date(`${publishStartDate}T00:00:00`);
		const end = new Date(`${publishEndDate}T00:00:00`);

		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
			return 0;
		}

		const timeKeys = [...new Set(customTime ? [...selectedTimes, customTime] : selectedTimes)].filter(Boolean);

		if (timeKeys.length === 0) {
			return 0;
		}

		let dayCount = 0;

		for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
			const day = cursor.getDay();
			if (excludeWeekends && (day === 0 || day === 6)) {
				continue;
			}
			dayCount += 1;
		}

		return dayCount * timeKeys.length;
	}

	const publishEnhance: SubmitFunction = () => {
		publishSubmitting = true;
		publishError = '';

		return async ({ result, update }) => {
			publishSubmitting = false;

			if (result.type === 'success') {
				await update();
				closePublishModal();
				showToast(result.data?.message ?? 'Slots published.');
				return;
			}

			await applyAction(result);

			if (result.type === 'failure') {
				publishError = result.data?.message ?? 'Could not publish slots.';
			} else if (result.type === 'error') {
				publishError = 'Something went wrong while publishing slots.';
			}
		};
	};

	function cancelCrossGuideConfirm() {
		crossGuideConfirm = null;
		confirmedCrossGuideActionKey = null;
	}

	function proceedCrossGuideConfirm() {
		crossGuideConfirm?.submit();
	}

	function slotActionEnhance(
		slot: ListSlot,
		loadingLabel: string,
		confirmAction?: CrossGuideAction
	): SubmitFunction {
		return ({ formData, formElement, cancel, submitter }) => {
			const actionKey = buildCrossGuideActionKey(slot.id, loadingLabel);

			if (confirmAction && !slot.isOwnSlot && confirmedCrossGuideActionKey !== actionKey) {
				cancel();
				const submitButton =
					submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
						? submitter
						: undefined;
				crossGuideConfirm = {
					action: confirmAction,
					slotId: slot.id,
					guideLabel: slot.guideLabel,
					formData,
					submit: () => {
						confirmedCrossGuideActionKey = actionKey;
						crossGuideConfirm = null;
						formElement.requestSubmit(submitButton);
					}
				};
				return;
			}

			slotActionSubmitting = actionKey;

			return async ({ result, update }) => {
				slotActionSubmitting = null;
				if (confirmedCrossGuideActionKey === actionKey) {
					confirmedCrossGuideActionKey = null;
				}

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Slot updated.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not update this slot.'
						: 'Something went wrong while updating this slot.',
					'error'
				);
			};
		};
	}

	function showMeetingLinkForm(slot: ListSlot) {
		return (slot.status === 'booked' || slot.status === 'completed') && Boolean(slot.bookingId);
	}

	resetPublishForm();
</script>

<svelte:head>
	<title>Slots | Authentic Admin</title>
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
			<p class="section-eyebrow">Milestone 4</p>
			<h1 class="panel-title">Slots</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Track guide availability week by week, see booked conversations in context, and publish new
				openings without leaving the calendar view.
			</p>
		</div>

		{#if data.canPublish}
			<button
				type="button"
				class="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
				onclick={openPublishModal}
				disabled={guidePublishUnavailable}
			>
				Publish slots
			</button>
			{#if data.publishDisabledReason}
				<div class="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-on-surface-variant">
					{data.publishDisabledReason}
				</div>
			{/if}
		{:else}
			<div class="rounded-2xl border border-sand bg-surface px-4 py-3 text-sm text-on-surface-variant">
				Only staff members can publish or edit slots from this screen.
			</div>
		{/if}
	</div>

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Slot Data Issues</p>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">This Week</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.total}</p>
			<p class="text-sm text-on-surface-variant">Slots visible in the current weekly scope.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Open</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.open}</p>
			<p class="text-sm text-on-surface-variant">Open times ready to accept a booking.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Booked</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.booked}</p>
			<p class="text-sm text-on-surface-variant">Confirmed conversations on the calendar.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Completed</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.completed}</p>
			<p class="text-sm text-on-surface-variant">Sessions marked complete in this weekly view.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow">Cancelled</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.cancelled}</p>
			<p class="text-sm text-on-surface-variant">Slots blocked out or cancelled.</p>
		</div>
		<div class="shell-card space-y-2">
			<p class="section-eyebrow text-error-strong">Expired</p>
			<p class="font-display text-3xl font-semibold text-on-surface">{data.summary.expired}</p>
			<p class="text-sm text-on-surface-variant">Past slots automatically closed by the scheduler.</p>
		</div>
	</div>

	<div class="shell-card space-y-5">
		<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
			<form method="GET" class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[240px_auto] xl:items-end">
				<input type="hidden" name="week" value={data.week.start} />
				<input type="hidden" name="view" value={data.filters.view} />

				{#if data.role !== 'guide'}
					<div class="space-y-2">
						<label class="text-sm font-semibold text-on-surface" for="guide">Guide</label>
						<select id="guide" name="guide" class="input-base">
							<option value="all" selected={data.filters.guide === 'all'}>All guides</option>
							{#each data.guides as guide}
								<option value={guide.id} selected={data.filters.guide === guide.id}>
									{guide.label}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="flex gap-3 pt-0 md:pt-6">
					<button type="submit" class="button-primary">Apply</button>
					<a href={buildResetHref()} class="button-secondary">Reset</a>
				</div>
			</form>

			<div class="flex flex-col gap-3 xl:items-end">
				<div class="inline-flex rounded-2xl border border-sand bg-background p-1">
					<a
						href={buildHref(data.week.start, 'calendar')}
						class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
							data.filters.view === 'calendar'
								? 'bg-primary text-white'
								: 'text-on-surface-variant'
						}`}
					>
						Calendar
					</a>
					<a
						href={buildHref(data.week.start, 'list')}
						class={`rounded-2xl px-4 py-2 text-sm font-semibold ${
							data.filters.view === 'list' ? 'bg-primary text-white' : 'text-on-surface-variant'
						}`}
					>
						List
					</a>
				</div>

				<div class="flex items-center gap-3">
					<a class="button-secondary" href={buildHref(data.week.prevStart)}>
						Previous week
					</a>
					<div class="rounded-2xl border border-sand bg-surface px-4 py-2 text-sm font-semibold text-on-surface">
						{data.week.label}
					</div>
					<a class="button-secondary" href={buildHref(data.week.nextStart)}>
						Next week
					</a>
				</div>
			</div>
		</div>

		{#if data.listSlots.length === 0}
			<div class="rounded-[24px] border border-dashed border-sand bg-background p-6 text-center">
				<p class="text-sm font-semibold text-on-surface">No slots are visible in this week yet.</p>
				<p class="mt-2 text-sm text-on-surface-variant">
					{data.canPublish && !data.publishDisabledReason
						? 'Use Publish slots to seed the schedule for this week.'
						: data.publishDisabledReason ?? 'Your staff team has not published availability for this week yet.'}
				</p>
			</div>
		{:else if data.filters.view === 'calendar'}
			<div class="space-y-4 md:hidden">
				<div class="rounded-[24px] border border-sand bg-background px-4 py-3 text-sm text-on-surface-variant">
					Calendar cells collapse into an agenda list on mobile so each slot stays readable.
				</div>

				{#each data.listSlots as slot}
					<div class="rounded-[24px] border border-sand bg-background px-4 py-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold text-on-surface">{formatSlotDate(slot.slotDate)}</p>
									{#if shouldShowGuideTag(slot)}
										<span class="inline-block rounded-full bg-sand/60 px-2 py-0.5 text-xs text-on-surface-variant">
											{slot.guideLabel}
										</span>
									{/if}
								</div>
								<p class="text-sm text-on-surface-variant">{slot.timeLabel}</p>
								<div class="flex flex-wrap gap-2">
									<span class={`badge ${statusToneClass(slot.statusTone)}`}>
										{statusLabel(slot.status)}
									</span>
									{#if slot.paymentStatus}
										<span class="badge bg-background text-on-surface-variant">
											Payment {slot.paymentStatus}
										</span>
									{/if}
								</div>
							</div>

							{#if canMutateSlot(slot)}
								<div class="flex flex-wrap gap-2">
									{#if slot.status === 'open'}
										<form
											method="POST"
											action="?/updateSlotStatus"
											use:enhance={slotActionEnhance(slot, 'cancel', 'cancel')}
										>
											<input type="hidden" name="slotId" value={slot.id} />
											<input type="hidden" name="status" value="cancelled" />
											<button
												type="submit"
												class="button-secondary text-xs"
												disabled={slotActionSubmitting === `${slot.id}:cancel`}
											>
												{slotActionSubmitting === `${slot.id}:cancel` ? 'Saving...' : 'Cancel'}
											</button>
										</form>
									{:else}
										<form
											method="POST"
											action="?/updateSlotStatus"
											use:enhance={slotActionEnhance(slot, 'reopen', 'reopen')}
										>
											<input type="hidden" name="slotId" value={slot.id} />
											<input type="hidden" name="status" value="open" />
											<button
												type="submit"
												class="button-secondary text-xs"
												disabled={slotActionSubmitting === `${slot.id}:reopen`}
											>
												{slotActionSubmitting === `${slot.id}:reopen` ? 'Saving...' : 'Reopen'}
											</button>
										</form>
									{/if}
								</div>
							{/if}
						</div>

						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							<div class="rounded-2xl border border-sand bg-surface px-4 py-3">
								<p class="section-eyebrow">Guide</p>
								<p class="mt-2 text-sm font-semibold text-on-surface">{slot.guideLabel}</p>
							</div>
							<div class="rounded-2xl border border-sand bg-surface px-4 py-3">
								<p class="section-eyebrow">Member</p>
								<p class="mt-2 text-sm font-semibold text-on-surface">{slot.memberLabel}</p>
							</div>
						</div>

						{#if showMeetingLinkForm(slot)}
							<div class="mt-4">
								<p class="section-eyebrow mb-2">Meeting link</p>
								<form
									method="POST"
									action="?/updateMeetingLink"
									use:enhance={slotActionEnhance(slot, 'meeting-link', 'update')}
									class="flex gap-2"
								>
									<input type="hidden" name="bookingId" value={slot.bookingId ?? ''} />
									<input
										type="url"
										name="meetingLink"
										value={slot.meetingLink ?? ''}
										placeholder="Paste Google Meet, Zoom, or Teams link..."
										class="input-base flex-1 text-sm"
									/>
									<button
										type="submit"
										class="button-secondary shrink-0 text-sm"
										disabled={slotActionSubmitting === `${slot.id}:meeting-link`}
									>
										{slotActionSubmitting === `${slot.id}:meeting-link` ? 'Saving...' : 'Save'}
									</button>
								</form>
								{#if slot.meetingLink}
									<a
										href={slot.meetingLink}
										target="_blank"
										rel="noreferrer"
										class="mt-1.5 block text-xs text-primary underline"
									>
										Test link ->
									</a>
								{/if}
							</div>
						{/if}

						{#if slot.modifiedBy && slot.modifiedBy !== slot.createdBy && slot.modifiedByLabel}
							<p class="mt-3 text-xs text-on-surface-variant">
								Last modified by {slot.modifiedByLabel}
							</p>
						{/if}

						<div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
							<span>{slot.durationMinutes} min</span>
							{#if canMutateSlot(slot)}
								<span>|</span>
								<form
									method="POST"
									action="?/deleteSlot"
									use:enhance={slotActionEnhance(slot, 'remove', 'delete')}
								>
									<input type="hidden" name="slotId" value={slot.id} />
									<button
										type="submit"
										class="text-sm font-semibold text-error-strong"
										disabled={slotActionSubmitting === `${slot.id}:remove`}
									>
										{slotActionSubmitting === `${slot.id}:remove` ? 'Removing...' : 'Remove slot'}
									</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="hidden overflow-x-auto md:block">
				<div class="grid min-w-[980px] grid-cols-[112px_repeat(5,minmax(0,1fr))] gap-px rounded-[28px] border border-sand bg-sand/60 p-px">
					<div class="bg-background px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
						Time
					</div>
					{#each data.weekDays as day}
						<div class="bg-background px-4 py-4">
							<p class="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								{day.label}
							</p>
							<p class="mt-1 text-sm text-on-surface-variant">{day.fullLabel}</p>
						</div>
					{/each}

					{#each data.calendarRows as row}
						<div class="bg-surface px-4 py-5">
							<p class="text-sm font-semibold text-on-surface">{row.timeLabel}</p>
						</div>

						{#each row.cells as cell}
							<div class="min-h-32 bg-surface p-3">
								{#if cell.items.length === 0}
									<div class="flex h-full items-center justify-center rounded-[20px] border border-dashed border-sand bg-background/80 px-3 text-center text-xs text-on-surface-variant">
										No slot
									</div>
								{:else}
									<div class="space-y-3">
										{#each cell.items as item}
											<div
												class={`rounded-[22px] border border-sand bg-background p-3 shadow-[0_8px_20px_rgba(8,39,23,0.06)] ${
													!item.isOwnSlot ? 'border-b-[3px] border-b-primary/40' : ''
												}`}
											>
												<div class="flex items-start justify-between gap-2">
													<p class="text-sm font-semibold text-on-surface">{item.timeLabel}</p>
													<div class="flex items-center gap-2">
														{#if !item.isOwnSlot}
															<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sand/60 text-[10px] font-semibold text-on-surface-variant">
																{item.guideInitials}
															</span>
														{/if}
														<span class={`badge ${statusToneClass(item.statusTone)}`}>
															{statusLabel(item.status)}
														</span>
													</div>
												</div>
												<div class="mt-3 space-y-1 text-xs leading-6 text-on-surface-variant">
													{#if showGuideNames()}
														<p>{item.guideLabel}</p>
													{/if}
													<p>{item.memberLabel}</p>
													<p>{item.durationMinutes} min</p>
													{#if item.paymentStatus}
														<p>Payment {item.paymentStatus}</p>
													{/if}
												</div>
												{#if showMeetingLinkForm(item)}
													<div class="mt-3">
														<p class="section-eyebrow mb-2">Meeting link</p>
														<form
															method="POST"
															action="?/updateMeetingLink"
															use:enhance={slotActionEnhance(item, 'meeting-link', 'update')}
															class="space-y-2"
														>
															<input type="hidden" name="bookingId" value={item.bookingId ?? ''} />
															<input
																type="url"
																name="meetingLink"
																value={item.meetingLink ?? ''}
																placeholder="Paste Google Meet, Zoom, or Teams link..."
																class="input-base text-xs"
															/>
															<button
																type="submit"
																class="button-secondary w-full text-xs"
																disabled={slotActionSubmitting === `${item.id}:meeting-link`}
															>
																{slotActionSubmitting === `${item.id}:meeting-link` ? 'Saving...' : 'Save'}
															</button>
														</form>
														{#if item.meetingLink}
															<a
																href={item.meetingLink}
																target="_blank"
																rel="noreferrer"
																class="mt-1.5 block text-xs text-primary underline"
															>
																Test link ->
															</a>
														{/if}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{/each}
				</div>
			</div>
		{:else}
			<div class="space-y-4 md:hidden">
				{#each data.listSlots as slot}
					<div class="rounded-[24px] border border-sand bg-background px-4 py-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold text-on-surface">{formatSlotDate(slot.slotDate)}</p>
									{#if shouldShowGuideTag(slot)}
										<span class="inline-block rounded-full bg-sand/60 px-2 py-0.5 text-xs text-on-surface-variant">
											{slot.guideLabel}
										</span>
									{/if}
								</div>
								<p class="text-sm text-on-surface-variant">{slot.timeLabel}</p>
								<div class="flex flex-wrap gap-2">
									<span class={`badge ${statusToneClass(slot.statusTone)}`}>
										{statusLabel(slot.status)}
									</span>
									{#if slot.paymentStatus}
										<span class="badge bg-background text-on-surface-variant">
											Payment {slot.paymentStatus}
										</span>
									{/if}
								</div>
							</div>

							{#if canMutateSlot(slot)}
								<div class="flex flex-wrap gap-2">
									{#if slot.status === 'open'}
										<form
											method="POST"
											action="?/updateSlotStatus"
											use:enhance={slotActionEnhance(slot, 'cancel', 'cancel')}
										>
											<input type="hidden" name="slotId" value={slot.id} />
											<input type="hidden" name="status" value="cancelled" />
											<button
												type="submit"
												class="button-secondary text-xs"
												disabled={slotActionSubmitting === `${slot.id}:cancel`}
											>
												{slotActionSubmitting === `${slot.id}:cancel` ? 'Saving...' : 'Cancel'}
											</button>
										</form>
									{:else}
										<form
											method="POST"
											action="?/updateSlotStatus"
											use:enhance={slotActionEnhance(slot, 'reopen', 'reopen')}
										>
											<input type="hidden" name="slotId" value={slot.id} />
											<input type="hidden" name="status" value="open" />
											<button
												type="submit"
												class="button-secondary text-xs"
												disabled={slotActionSubmitting === `${slot.id}:reopen`}
											>
												{slotActionSubmitting === `${slot.id}:reopen` ? 'Saving...' : 'Reopen'}
											</button>
										</form>
									{/if}
								</div>
							{/if}
						</div>

						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							<div class="rounded-2xl border border-sand bg-surface px-4 py-3">
								<p class="section-eyebrow">Guide</p>
								<p class="mt-2 text-sm font-semibold text-on-surface">{slot.guideLabel}</p>
							</div>
							<div class="rounded-2xl border border-sand bg-surface px-4 py-3">
								<p class="section-eyebrow">Member</p>
								<p class="mt-2 text-sm font-semibold text-on-surface">{slot.memberLabel}</p>
							</div>
						</div>

						{#if showMeetingLinkForm(slot)}
							<div class="mt-4">
								<p class="section-eyebrow mb-2">Meeting link</p>
								<form
									method="POST"
									action="?/updateMeetingLink"
									use:enhance={slotActionEnhance(slot, 'meeting-link', 'update')}
									class="flex gap-2"
								>
									<input type="hidden" name="bookingId" value={slot.bookingId ?? ''} />
									<input
										type="url"
										name="meetingLink"
										value={slot.meetingLink ?? ''}
										placeholder="Paste Google Meet, Zoom, or Teams link..."
										class="input-base flex-1 text-sm"
									/>
									<button
										type="submit"
										class="button-secondary shrink-0 text-sm"
										disabled={slotActionSubmitting === `${slot.id}:meeting-link`}
									>
										{slotActionSubmitting === `${slot.id}:meeting-link` ? 'Saving...' : 'Save'}
									</button>
								</form>
								{#if slot.meetingLink}
									<a
										href={slot.meetingLink}
										target="_blank"
										rel="noreferrer"
										class="mt-1.5 block text-xs text-primary underline"
									>
										Test link ->
									</a>
								{/if}
							</div>
						{/if}

						{#if slot.modifiedBy && slot.modifiedBy !== slot.createdBy && slot.modifiedByLabel}
							<p class="mt-3 text-xs text-on-surface-variant">
								Last modified by {slot.modifiedByLabel}
							</p>
						{/if}

						<div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
							<span>{slot.durationMinutes} min</span>
							{#if canMutateSlot(slot)}
								<span>|</span>
								<form
									method="POST"
									action="?/deleteSlot"
									use:enhance={slotActionEnhance(slot, 'remove', 'delete')}
								>
									<input type="hidden" name="slotId" value={slot.id} />
									<button
										type="submit"
										class="text-sm font-semibold text-error-strong"
										disabled={slotActionSubmitting === `${slot.id}:remove`}
									>
										{slotActionSubmitting === `${slot.id}:remove` ? 'Removing...' : 'Remove slot'}
									</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="hidden overflow-x-auto md:block">
				<table class="min-w-full border-separate border-spacing-0">
					<thead>
						<tr class="text-left">
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Date
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Time
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Guide
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Member
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Duration
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Meeting Link
							</th>
							<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
								Status
							</th>
							{#if data.canPublish}
								<th class="border-b border-sand px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
									Actions
								</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each data.listSlots as slot}
							<tr class="align-top">
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface">
									<div class="flex flex-wrap items-center gap-2">
										<span>{formatSlotDate(slot.slotDate)}</span>
										{#if shouldShowGuideTag(slot)}
											<span class="inline-block rounded-full bg-sand/60 px-2 py-0.5 text-xs text-on-surface-variant">
												{slot.guideLabel}
											</span>
										{/if}
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface">
									{slot.timeLabel}
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface-variant">
									<div class="space-y-1">
										<p>{slot.guideLabel}</p>
										{#if slot.modifiedBy && slot.modifiedBy !== slot.createdBy && slot.modifiedByLabel}
											<p class="text-xs">Last modified by {slot.modifiedByLabel}</p>
										{/if}
									</div>
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface-variant">
									{slot.memberLabel}
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface-variant">
									{slot.durationMinutes} min
								</td>
								<td class="border-b border-sand/80 px-4 py-4 text-sm text-on-surface-variant">
									{#if showMeetingLinkForm(slot)}
										<div class="min-w-[260px] space-y-2">
											<form
												method="POST"
												action="?/updateMeetingLink"
												use:enhance={slotActionEnhance(slot, 'meeting-link', 'update')}
												class="flex gap-2"
											>
												<input type="hidden" name="bookingId" value={slot.bookingId ?? ''} />
												<input
													type="url"
													name="meetingLink"
													value={slot.meetingLink ?? ''}
													placeholder="Paste Google Meet, Zoom, or Teams link..."
													class="input-base flex-1 text-sm"
												/>
												<button
													type="submit"
													class="button-secondary shrink-0 text-xs"
													disabled={slotActionSubmitting === `${slot.id}:meeting-link`}
												>
													{slotActionSubmitting === `${slot.id}:meeting-link` ? 'Saving...' : 'Save'}
												</button>
											</form>
											{#if slot.meetingLink}
												<a
													href={slot.meetingLink}
													target="_blank"
													rel="noreferrer"
													class="block text-xs text-primary underline break-all"
												>
													{slot.meetingLink}
												</a>
											{/if}
										</div>
									{:else}
										<span class="text-xs italic">
											{slot.status === 'open' || slot.status === 'cancelled'
												? 'Available after booking'
												: 'No linked booking'}
										</span>
									{/if}
								</td>
								<td class="border-b border-sand/80 px-4 py-4">
									<div class="flex flex-wrap gap-2">
										<span class={`badge ${statusToneClass(slot.statusTone)}`}>
											{statusLabel(slot.status)}
										</span>
										{#if slot.paymentStatus}
											<span class="badge bg-background text-on-surface-variant">
												Payment {slot.paymentStatus}
											</span>
										{/if}
									</div>
								</td>
								{#if data.canPublish}
									<td class="border-b border-sand/80 px-4 py-4">
										<div class="flex flex-wrap gap-2">
											{#if slot.status === 'open'}
												<form
													method="POST"
													action="?/updateSlotStatus"
													use:enhance={slotActionEnhance(slot, 'cancel', 'cancel')}
												>
													<input type="hidden" name="slotId" value={slot.id} />
													<input type="hidden" name="status" value="cancelled" />
													<button
														type="submit"
														class="button-secondary text-xs"
														disabled={slotActionSubmitting === `${slot.id}:cancel`}
													>
														{slotActionSubmitting === `${slot.id}:cancel` ? 'Saving...' : 'Cancel'}
													</button>
												</form>
											{:else if slot.status === 'cancelled'}
												<form
													method="POST"
													action="?/updateSlotStatus"
													use:enhance={slotActionEnhance(slot, 'reopen', 'reopen')}
												>
													<input type="hidden" name="slotId" value={slot.id} />
													<input type="hidden" name="status" value="open" />
													<button
														type="submit"
														class="button-secondary text-xs"
														disabled={slotActionSubmitting === `${slot.id}:reopen`}
													>
														{slotActionSubmitting === `${slot.id}:reopen` ? 'Saving...' : 'Reopen'}
													</button>
												</form>
											{/if}

											{#if slot.status === 'open' || slot.status === 'cancelled'}
												<form
													method="POST"
													action="?/deleteSlot"
													use:enhance={slotActionEnhance(slot, 'remove', 'delete')}
												>
													<input type="hidden" name="slotId" value={slot.id} />
													<button
														type="submit"
														class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
														disabled={slotActionSubmitting === `${slot.id}:remove`}
													>
														{slotActionSubmitting === `${slot.id}:remove` ? 'Removing...' : 'Remove'}
													</button>
												</form>
											{/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>

{#if crossGuideConfirm}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		onclick={cancelCrossGuideConfirm}
		onkeydown={(event) => event.key === 'Escape' && cancelCrossGuideConfirm()}
	></div>

	<div class="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-md -translate-y-1/2 rounded-[28px] border border-sand bg-surface p-6 shadow-[0_24px_80px_rgba(8,39,23,0.24)]">
		<p class="section-eyebrow">Confirm action</p>
		<h2 class="mt-2 text-xl font-semibold text-on-surface">Editing another guide&apos;s slot</h2>
		<p class="mt-3 text-sm leading-7 text-on-surface-variant">
			You are about to {describeCrossGuideAction(crossGuideConfirm.action)} a slot belonging to
			<span class="font-semibold text-on-surface">{crossGuideConfirm.guideLabel}</span>. Continue?
		</p>
		<div class="mt-6 flex justify-end gap-3">
			<button type="button" class="button-secondary" onclick={cancelCrossGuideConfirm}>
				Go Back
			</button>
			<button type="button" class="button-primary" onclick={proceedCrossGuideConfirm}>
				Yes, Continue
			</button>
		</div>
	</div>
{/if}

{#if publishModalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		onclick={closePublishModal}
		onkeydown={(event) => event.key === 'Escape' && closePublishModal()}
	></div>

	<div class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-sand bg-surface px-5 py-6 shadow-[-24px_0_80px_rgba(8,39,23,0.16)] sm:max-w-xl sm:px-8">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="section-eyebrow">Publish availability</p>
				<h2 class="panel-title">Create a batch of open slots</h2>
				<p class="text-sm leading-7 text-on-surface-variant">
					Choose a guide, a date range, and the time blocks you want to open for booking. Existing
					slots for the same guide, date, and time are skipped automatically.
				</p>
			</div>

			<button type="button" class="button-secondary" onclick={closePublishModal}>Close</button>
		</div>

		<form
			method="POST"
			action="?/publishSlots"
			class="mt-8 space-y-5"
			use:enhance={publishEnhance}
		>
			{#if data.role === 'admin' || data.role === 'moderator'}
				{#if !data.myGuideId}
					<div class="rounded-[24px] border border-red-200 bg-error/40 px-4 py-4 text-sm text-error-strong">
						You need a guide profile to publish slots. Ask an admin to create one from the Team page.
					</div>
				{:else}
					<input type="hidden" name="guideId" value={resolvePublishGuideId()} />
					<div class="rounded-[24px] border border-sand bg-background px-4 py-4 text-sm text-on-surface-variant">
						Slots will be published under your guide profile,
						<span class="font-semibold text-on-surface">{ownGuide?.label ?? 'your profile'}</span>.
					</div>
					<button
						type="button"
						class="text-left text-xs text-on-surface-variant underline"
						onclick={() => {
							publishForOther = !publishForOther;
							publishGuideId = publishForOther ? (otherGuides[0]?.id ?? '') : '';
						}}
					>
						{publishForOther ? 'Publish for myself' : 'Publish for another guide'}
					</button>

					{#if publishForOther}
						<div class="rounded-[24px] border border-amber-200 bg-[#FFF4D6] px-4 py-4 text-sm text-[#6A4B00]">
							You are publishing slots on behalf of another guide.
						</div>

						<div class="space-y-2">
							<label class="text-sm font-semibold text-on-surface" for="guideId">Guide</label>
							<select
								id="guideId"
								class="input-base"
								bind:value={publishGuideId}
								required={publishForOther}
								disabled={otherGuides.length === 0}
							>
								<option value="" disabled>Select a guide</option>
								{#each otherGuides as guide}
									<option value={guide.id}>{guide.label}</option>
								{/each}
							</select>
							{#if otherGuides.length === 0}
								<p class="text-xs text-on-surface-variant">
									No other guide profiles are available right now.
								</p>
							{/if}
						</div>
					{/if}
				{/if}
			{:else}
				<input type="hidden" name="guideId" value={data.myGuideId ?? data.guides[0]?.id ?? ''} />
				<div class="rounded-[24px] border border-sand bg-background px-4 py-4 text-sm text-on-surface-variant">
					{#if data.guides[0]}
						Slots will be published under your guide profile,
						<span class="font-semibold text-on-surface">{data.guides[0].label}</span>.
					{:else}
						Your account is not linked to a guide profile yet, so slot publishing is unavailable.
					{/if}
				</div>
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="startDate">Start date</label>
					<input
						id="startDate"
						name="startDate"
						type="date"
						class="input-base"
						bind:value={publishStartDate}
						required
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="endDate">End date</label>
					<input
						id="endDate"
						name="endDate"
						type="date"
						class="input-base"
						bind:value={publishEndDate}
						required
					/>
				</div>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-semibold text-on-surface" for="duration">Duration</label>
				<select id="duration" name="duration" class="input-base" bind:value={publishDuration}>
					<option value="30">30 minutes</option>
					<option value="45">45 minutes</option>
					<option value="60">60 minutes</option>
					<option value="90">90 minutes</option>
				</select>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<p class="text-sm font-semibold text-on-surface">Time slots</p>
				<p class="mt-1 text-sm text-on-surface-variant">
					Choose every time block you want repeated across the selected range.
				</p>

				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each data.timeOptions as option}
						<label class="flex items-center gap-3 rounded-2xl border border-sand bg-surface px-4 py-3 text-sm font-semibold text-on-surface">
							<input
								type="checkbox"
								name="times"
								value={option.value}
								bind:group={selectedTimes}
								class="accent-primary"
							/>
							<span>{option.label}</span>
						</label>
					{/each}
				</div>

				<div class="mt-4 space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="customTime">Custom time</label>
					<input
						id="customTime"
						name="customTime"
						type="time"
						class="input-base"
						bind:value={customTime}
					/>
				</div>
			</div>

			<div class="rounded-[24px] border border-sand bg-background p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="space-y-1">
						<p class="text-sm font-semibold text-on-surface">Exclude weekends</p>
						<p class="text-sm text-on-surface-variant">
							Weekends are skipped from the publish range by default.
						</p>
					</div>

					<label class="inline-flex items-center gap-3 text-sm font-semibold text-on-surface">
						<input
							type="checkbox"
							name="excludeWeekends"
							bind:checked={excludeWeekends}
							class="accent-primary"
						/>
						<span>{excludeWeekends ? 'Yes' : 'No'}</span>
					</label>
				</div>
			</div>

			<div class="rounded-[24px] border border-primary/15 bg-success/55 p-4">
				<p class="section-eyebrow text-primary-dark">Preview</p>
				<p class="mt-2 font-display text-3xl font-semibold text-primary-dark">
					{publishPreviewCount()}
				</p>
				<p class="mt-2 text-sm text-primary-dark/80">
					Projected new slots before duplicate checks run on the server.
				</p>
			</div>

			{#if publishError}
				<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
					{publishError}
				</div>
			{:else if form?.message}
				<div class="rounded-3xl border border-sand bg-background px-4 py-3 text-sm text-on-surface-variant">
					{form.message}
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<button type="button" class="button-secondary" onclick={closePublishModal}>Cancel</button>
				<button
					type="submit"
					class="button-primary"
					disabled={publishSubmitting || !resolvePublishGuideId()}
				>
					{publishSubmitting ? 'Publishing...' : 'Publish slots'}
				</button>
			</div>
		</form>
	</div>
{/if}
