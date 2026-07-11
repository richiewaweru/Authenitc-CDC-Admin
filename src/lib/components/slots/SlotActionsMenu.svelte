<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	type SlotAction = 'cancel' | 'reopen' | 'delete' | 'update';
	type SlotStatus = 'open' | 'booked' | 'cancelled' | 'completed' | 'closed' | 'expired';
	type Slot = {
		id: string;
		status: SlotStatus;
		isOwnSlot: boolean;
		guideLabel: string;
	};

	type Props = {
		slot: Slot;
		canMutate: boolean;
		submittingKey: string | null;
		slotActionEnhance: (slot: any, loadingLabel: string, confirmAction?: SlotAction) => SubmitFunction;
		onEdit: (slot: any) => void;
		align?: 'left' | 'right';
	};

	let {
		slot,
		canMutate,
		submittingKey,
		slotActionEnhance,
		onEdit,
		align = 'right'
	}: Props = $props();
	let open = $state(false);

	const menuId = $derived(`slot-actions-${slot.id}`);
	const canToggleStatus = $derived(slot.status === 'open' || slot.status === 'cancelled');
	const isSubmitting = $derived((label: string) => submittingKey === `${slot.id}:${label}`);

	function closeMenu() {
		open = false;
	}

	function editSlot() {
		closeMenu();
		onEdit(slot);
	}
</script>

{#if canMutate}
	<div class="relative inline-flex">
		<button
			type="button"
			class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand bg-surface text-on-surface hover:bg-background"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls={menuId}
			title="Slot actions"
			onclick={() => (open = !open)}
		>
			<span class="sr-only">Slot actions</span>
			<span class="text-lg leading-none" aria-hidden="true">...</span>
		</button>

		{#if open}
			<div
				id={menuId}
				role="menu"
				class={`absolute top-10 z-30 w-44 rounded-2xl border border-sand bg-surface p-2 text-sm shadow-[0_18px_48px_rgba(8,39,23,0.16)] ${
					align === 'right' ? 'right-0' : 'left-0'
				}`}
			>
				<button
					type="button"
					role="menuitem"
					class="flex w-full items-center rounded-xl px-3 py-2 text-left font-semibold text-on-surface hover:bg-background"
					onclick={editSlot}
				>
					Edit
				</button>

				{#if canToggleStatus}
					<form
						method="POST"
						action="?/updateSlotStatus"
						use:enhance={slotActionEnhance(
							slot,
							slot.status === 'open' ? 'cancel' : 'reopen',
							slot.status === 'open' ? 'cancel' : 'reopen'
						)}
					>
						<input type="hidden" name="slotId" value={slot.id} />
						<input type="hidden" name="status" value={slot.status === 'open' ? 'cancelled' : 'open'} />
						<button
							type="submit"
							role="menuitem"
							class="flex w-full items-center rounded-xl px-3 py-2 text-left font-semibold text-on-surface hover:bg-background disabled:opacity-60"
							disabled={isSubmitting(slot.status === 'open' ? 'cancel' : 'reopen')}
						>
							{#if slot.status === 'open'}
								{isSubmitting('cancel') ? 'Saving...' : 'Cancel'}
							{:else}
								{isSubmitting('reopen') ? 'Saving...' : 'Reopen'}
							{/if}
						</button>
					</form>
				{/if}

				<form method="POST" action="?/deleteSlot" use:enhance={slotActionEnhance(slot, 'remove', 'delete')}>
					<input type="hidden" name="slotId" value={slot.id} />
					<button
						type="submit"
						role="menuitem"
						class="flex w-full items-center rounded-xl px-3 py-2 text-left font-semibold text-error-strong hover:bg-error/50 disabled:opacity-60"
						disabled={isSubmitting('remove')}
					>
						{isSubmitting('remove') ? 'Removing...' : 'Remove'}
					</button>
				</form>
			</div>
		{/if}
	</div>
{/if}
