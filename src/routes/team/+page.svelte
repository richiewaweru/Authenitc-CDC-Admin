<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';

	type ModeratorRow = (typeof data.moderators)[number];
	type PendingInviteRow = (typeof data.pendingInvites)[number];

	let { data, form } = $props();

	let showModal = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'moderator' | 'guide'>('moderator');
	let guideName = $state('');
	let guideTitle = $state('Community Guide');
	let inviteError = $state('');
	let inviteSubmitting = $state(false);
	let actionSubmitting = $state<string | null>(null);
	let toastMessage = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastVisible = $state(false);
	let inviteDelivery = $state<{
		email: string;
		role: 'moderator' | 'guide';
		link: string;
		message: string;
	} | null>(null);

	let matchedMember = $derived(
		inviteRole === 'moderator'
			? data.memberCandidates.find(
					(candidate) => candidate.email.toLowerCase() === inviteEmail.trim().toLowerCase()
				) ?? null
			: null
	);

	const moderatorCan = [
		'View all member profiles',
		'Manage guides and update roster details',
		'Publish and manage time slots',
		'View and update bookings'
	];
	const moderatorCannot = [
		'Delete guides',
		'Add or remove moderators',
		'Change user roles',
		'Access payment settings'
	];

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;

		setTimeout(() => {
			toastVisible = false;
		}, 4000);
	}

	async function copyInviteLink(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			showToast('Invite link copied.');
		} catch {
			showToast('Could not copy the invite link automatically.', 'error');
		}
	}

	function getInitials(name: string | null, email: string | null): string {
		const source = name || email?.split('@')[0] || '?';
		return source
			.split(/[\s._-]+/)
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join('');
	}

	function timeAgo(dateStr: string | null) {
		if (!dateStr) {
			return '';
		}

		const diff = Date.now() - new Date(dateStr).getTime();
		const minutes = Math.floor(diff / 60000);

		if (minutes < 60) {
			return `${minutes}m ago`;
		}

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}

		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function formatDate(dateStr: string | null) {
		if (!dateStr) {
			return 'Date unavailable';
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(dateStr));
	}

	function accountStateTone(state: (typeof data.guides)[number]['accountState']) {
		if (state === 'linked') {
			return 'bg-success text-primary-dark';
		}

		if (state === 'pending_setup') {
			return 'bg-warning/55 text-[#664D03]';
		}

		return 'bg-background text-on-surface-variant';
	}

	function closeModal() {
		showModal = false;
		inviteEmail = '';
		inviteRole = 'moderator';
		guideName = '';
		guideTitle = 'Community Guide';
		inviteError = '';
		inviteSubmitting = false;
	}

	function closeInviteDelivery() {
		inviteDelivery = null;
	}

	function openModal(role: 'moderator' | 'guide' = 'moderator') {
		closeModal();
		inviteRole = role;
		showModal = true;
	}

	function getGuideInviteProfile(email: string) {
		return data.guides.find((guide) => guide.email.toLowerCase() === email.toLowerCase()) ?? null;
	}

	const addTeamMemberEnhance: SubmitFunction = () => {
		inviteSubmitting = true;
		inviteError = '';

		return async ({ result, update }) => {
			inviteSubmitting = false;

			if (result.type === 'success') {
				await update();
				closeModal();
				showToast(result.data?.message ?? 'Team access updated.');

				if (result.data?.inviteLink && result.data?.inviteEmail && result.data?.inviteRole) {
					inviteDelivery = {
						email: result.data.inviteEmail,
						role: result.data.inviteRole,
						link: result.data.inviteLink,
						message: result.data.message ?? 'Invite link ready.'
					};
				}
				return;
			}

			await applyAction(result);
			inviteError =
				result.type === 'failure'
					? result.data?.message ?? 'Could not update team access.'
					: 'Something went wrong while updating team access.';
		};
	};

	function removeModeratorEnhance(moderator: ModeratorRow): SubmitFunction {
		return ({ cancel }) => {
			const approved = confirm(
				`Remove moderator access for ${moderator.label}? They will return to the member role.`
			);

			if (!approved) {
				cancel();
				return;
			}

			actionSubmitting = `remove:${moderator.id}`;

			return async ({ result, update }) => {
				actionSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Moderator access removed.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not remove moderator access.'
						: 'Something went wrong while removing moderator access.',
					'error'
				);
			};
		};
	}

	function refreshInviteEnhance(invite: PendingInviteRow): SubmitFunction {
		return () => {
			actionSubmitting = `refresh:${invite.id}`;

			return async ({ result, update }) => {
				actionSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Invite link refreshed.');

					if (result.data?.inviteLink && result.data?.inviteEmail && result.data?.inviteRole) {
						inviteDelivery = {
							email: result.data.inviteEmail,
							role: result.data.inviteRole,
							link: result.data.inviteLink,
							message: result.data.message ?? 'Invite link refreshed.'
						};
					}
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not refresh the invite.'
						: 'Something went wrong while refreshing the invite.',
					'error'
				);
			};
		};
	}

	function revokeInviteEnhance(invite: PendingInviteRow): SubmitFunction {
		return ({ cancel }) => {
			const approved = confirm(`Revoke the pending ${invite.role} invite for ${invite.email}?`);

			if (!approved) {
				cancel();
				return;
			}

			actionSubmitting = `revoke:${invite.id}`;

			return async ({ result, update }) => {
				actionSubmitting = null;

				if (result.type === 'success') {
					await update();
					showToast(result.data?.message ?? 'Invite revoked.');
					return;
				}

				await applyAction(result);
				showToast(
					result.type === 'failure'
						? result.data?.message ?? 'Could not revoke the invite.'
						: 'Something went wrong while revoking the invite.',
					'error'
				);
			};
		};
	}
</script>

<svelte:head>
	<title>Team Management | Authentic Admin</title>
</svelte:head>

{#if toastVisible}
	<div
		class="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border px-5 py-3 text-sm font-medium shadow-lg {toastType === 'success'
			? 'border-green-200 bg-success text-primary-dark'
			: 'border-red-200 bg-error text-error-strong'}"
	>
		{toastMessage}
	</div>
{/if}

<section class="space-y-8">
	<div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
		<div class="space-y-2">
			<p class="section-eyebrow">Milestone 7</p>
			<h1 class="panel-title">Team Management</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant">
				Only admins can access this page. Promote moderators, track guide linking status, and
				manage pending invite links from one place.
			</p>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row">
			<button type="button" class="button-secondary" onclick={() => openModal('guide')}>
				<Icon name="guides" className="mr-2 h-4 w-4" />
				Invite guide
			</button>
			<button type="button" class="button-primary" onclick={() => openModal('moderator')}>
				<Icon name="team" className="mr-2 h-4 w-4" />
				Add moderator
			</button>
		</div>
	</div>

	{#if form?.message}
		<div
			class={`shell-card ${form.success ? 'border-primary/20 bg-success/55 text-primary-dark' : 'border-red-200 bg-error/40 text-error-strong'}`}
		>
			<p class="text-sm font-medium">{form.message}</p>
		</div>
	{/if}

	{#if data.issues.length > 0}
		<div class="shell-card space-y-3 border-red-200 bg-error/40">
			<p class="section-eyebrow text-error-strong">Team Data Issues</p>
			<ul class="space-y-2 text-sm leading-7 text-error-strong">
				{#each data.issues as issue}
					<li>{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if inviteDelivery}
		<div class="shell-card space-y-4 border-primary/20 bg-success/55">
			<div class="space-y-1">
				<p class="section-eyebrow text-primary-dark">Invite Link Ready</p>
				<h2 class="font-display text-2xl font-semibold text-primary-dark">{inviteDelivery.message}</h2>
				<p class="text-sm text-primary-dark/80">
					Send this secure setup link to <span class="font-semibold">{inviteDelivery.email}</span>. They
					will use it once to finish their <span class="font-semibold">{inviteDelivery.role}</span>
					account setup.
				</p>
			</div>

			<div class="rounded-[24px] border border-primary/15 bg-white/80 p-4">
				<p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
					Invite link
				</p>
				<textarea class="input-base min-h-28 resize-y text-xs leading-6" readonly value={inviteDelivery.link}></textarea>
			</div>

			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					class="button-primary"
					onclick={() => inviteDelivery && copyInviteLink(inviteDelivery.link)}
				>
					Copy link
				</button>
				<a class="button-secondary" href={inviteDelivery.link} target="_blank" rel="noreferrer">
					Open link
				</a>
				<button type="button" class="button-secondary" onclick={closeInviteDelivery}>
					Dismiss
				</button>
			</div>
		</div>
	{/if}

	<div class="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
		<div class="min-w-0 space-y-4">
			<div class="shell-card min-w-0 space-y-4 overflow-hidden">
				<div class="flex flex-wrap items-center gap-3">
					<p class="section-eyebrow">Admins</p>
					<span class="badge bg-background text-on-surface-variant">{data.admins.length}</span>
				</div>

				<div class="space-y-3">
					{#each data.admins as admin}
						<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
								<Avatar initials={getInitials(admin.label, admin.email)} name={admin.label} size="md" />
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class="truncate text-sm font-semibold text-on-surface">{admin.label}</p>
										{#if admin.isCurrentUser}
											<span class="badge bg-info text-info-strong">you</span>
										{/if}
									</div>
									<p class="break-all text-xs text-on-surface-variant sm:truncate">{admin.email}</p>
									<p class="mt-1 text-xs text-on-surface-variant">
										Owner account | added {formatDate(admin.createdAt)}
									</p>
								</div>
								<div class="self-start sm:shrink-0">
									<RoleBadge role="admin" />
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="shell-card min-w-0 space-y-4 overflow-hidden">
				<div class="flex flex-wrap items-center gap-3">
					<p class="section-eyebrow">Moderators</p>
					<span class="badge bg-background text-on-surface-variant">{data.moderators.length}</span>
				</div>

				{#if data.moderators.length === 0}
					<div class="rounded-2xl border border-dashed border-sand bg-background px-5 py-4 text-sm text-on-surface-variant">
						No moderators yet. Use the add-moderator flow to promote an existing member or send
						an invite.
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.moderators as moderator}
							<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
								<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
									<div class="flex min-w-0 flex-1 items-center gap-4">
										<Avatar
											initials={getInitials(moderator.label, moderator.email)}
											name={moderator.label}
											size="md"
										/>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<p class="truncate text-sm font-semibold text-on-surface">{moderator.label}</p>
												{#if moderator.suspended}
													<span class="badge bg-error text-error-strong">Suspended</span>
												{/if}
											</div>
											<p class="truncate text-xs text-on-surface-variant">{moderator.email}</p>
											<p class="mt-1 text-xs text-on-surface-variant">
												Added {formatDate(moderator.createdAt)}
											</p>
										</div>
									</div>

									<div class="flex gap-3 sm:shrink-0">
										<RoleBadge role="moderator" />
										<form
											method="POST"
											action="?/removeModerator"
											use:enhance={removeModeratorEnhance(moderator)}
										>
											<input type="hidden" name="moderatorId" value={moderator.id} />
											<button
												type="submit"
												class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
												disabled={actionSubmitting === `remove:${moderator.id}`}
											>
												{actionSubmitting === `remove:${moderator.id}` ? 'Removing...' : 'Remove'}
											</button>
										</form>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="min-w-0 space-y-4">
			<div class="shell-card min-w-0 space-y-4 overflow-hidden">
				<div class="flex flex-wrap items-center gap-3">
					<p class="section-eyebrow">Guides</p>
					<span class="badge bg-background text-on-surface-variant">{data.guides.length}</span>
				</div>

				{#if data.guides.length === 0}
					<div class="rounded-2xl border border-dashed border-sand bg-background px-5 py-4 text-sm text-on-surface-variant">
						Guide accounts will appear here once a guide invite is sent or a guide profile is linked.
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.guides as guide}
							<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
								<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
									<Avatar initials={getInitials(guide.label, guide.email)} name={guide.label} size="md" />
									<div class="min-w-0 flex-1 space-y-2">
										<div class="flex flex-wrap items-center gap-2">
											<p class="truncate text-sm font-semibold text-on-surface">{guide.label}</p>
											<span class={`badge ${accountStateTone(guide.accountState)}`}>{guide.linkLabel}</span>
										</div>
										<p class="text-xs text-on-surface-variant">{guide.title}</p>
										<p class="break-all text-xs text-on-surface-variant sm:truncate">{guide.linkedEmail}</p>
										<p class="text-xs text-on-surface-variant">
											{guide.isActive ? 'Active in the roster' : 'Inactive in the roster'} | added {formatDate(
												guide.createdAt
											)}
										</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="shell-card min-w-0 space-y-4 overflow-hidden">
				<div class="flex flex-wrap items-center gap-3">
					<p class="section-eyebrow">Pending Invites</p>
					<span class="badge bg-background text-on-surface-variant">{data.pendingInvites.length}</span>
				</div>

				{#if data.pendingInvites.length === 0}
					<div class="rounded-2xl border border-dashed border-sand bg-background px-5 py-4 text-sm text-on-surface-variant">
						No pending invites right now.
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.pendingInvites as invite}
							<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
								<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
									<div class="flex min-w-0 flex-1 items-center gap-4">
										<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info text-xs font-semibold text-info-strong">
											{getInitials(null, invite.email)}
										</div>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<p class="break-all text-sm font-semibold text-on-surface sm:truncate">{invite.email}</p>
												<RoleBadge role={invite.role} />
											</div>
											<p class="mt-1 text-xs text-on-surface-variant">{invite.statusNote}</p>
											<p class="mt-1 text-xs text-on-surface-variant">
												Sent {timeAgo(invite.createdAt)} | {formatDate(invite.createdAt)}
											</p>
										</div>
									</div>

									<div class="flex gap-2 sm:shrink-0">
										<form
											method="POST"
											action="?/refreshInvite"
											use:enhance={refreshInviteEnhance(invite)}
										>
											<input type="hidden" name="email" value={invite.email} />
											<input type="hidden" name="role" value={invite.role} />
											{#if invite.role === 'guide' && getGuideInviteProfile(invite.email)}
												<input
													type="hidden"
													name="guideName"
													value={getGuideInviteProfile(invite.email)?.label ?? ''}
												/>
												<input
													type="hidden"
													name="guideTitle"
													value={getGuideInviteProfile(invite.email)?.title ?? ''}
												/>
											{/if}
											<button
												type="submit"
												class="button-secondary text-xs"
												disabled={actionSubmitting === `refresh:${invite.id}`}
											>
												{actionSubmitting === `refresh:${invite.id}` ? 'Refreshing...' : 'Refresh link'}
											</button>
										</form>

										<form
											method="POST"
											action="?/revokeInvite"
											use:enhance={revokeInviteEnhance(invite)}
										>
											<input type="hidden" name="inviteId" value={invite.id} />
											<button
												type="submit"
												class="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-error/30 px-4 py-2.5 text-xs font-semibold text-error-strong hover:bg-error"
												disabled={actionSubmitting === `revoke:${invite.id}`}
											>
												{actionSubmitting === `revoke:${invite.id}` ? 'Revoking...' : 'Revoke'}
											</button>
										</form>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="shell-card min-w-0 space-y-4 overflow-hidden">
				<div class="space-y-1">
					<p class="section-eyebrow">Permissions Overview</p>
					<h2 class="font-display text-2xl font-semibold text-on-surface">Moderator guardrails</h2>
				</div>

				<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
					<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
						<p class="section-eyebrow">Moderators Can</p>
						<ul class="mt-3 space-y-2 text-sm leading-7 text-on-surface">
							{#each moderatorCan as item}
								<li>Allowed: {item}</li>
							{/each}
						</ul>
					</div>

					<div class="rounded-[24px] border border-sand bg-background px-5 py-4">
						<p class="section-eyebrow">Moderators Cannot</p>
						<ul class="mt-3 space-y-2 text-sm leading-7 text-on-surface">
							{#each moderatorCannot as item}
								<li>Blocked: {item}</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-primary-dark/40 backdrop-blur-sm"
		onclick={closeModal}
		onkeydown={(event) => event.key === 'Escape' && closeModal()}
	></div>

	<div class="fixed inset-0 z-50 flex items-center justify-center px-4">
		<div
			class="w-full max-w-xl rounded-[28px] border border-sand bg-surface p-6 shadow-[0_24px_80px_rgba(8,39,23,0.12)] sm:p-8"
			role="dialog"
			aria-labelledby="team-modal-title"
		>
			<div class="space-y-2">
				<p class="section-eyebrow">{inviteRole === 'moderator' ? 'Add Moderator' : 'Invite Guide'}</p>
				<h2 id="team-modal-title" class="font-display text-2xl font-semibold text-on-surface">
					{inviteRole === 'moderator' ? 'Search by email, then confirm promotion.' : 'Generate a guide setup link.'}
				</h2>
				<p class="text-sm leading-7 text-on-surface-variant">
					{inviteRole === 'moderator'
						? 'If the email matches an existing member, they will gain moderator access immediately. Otherwise we will prepare a secure invite link.'
						: 'Guide invites keep the same link-based setup flow used elsewhere in the admin panel.'}
				</p>
			</div>

			<form
				class="mt-6 space-y-5"
				method="POST"
				action="?/addTeamMember"
				use:enhance={addTeamMemberEnhance}
			>
				<div class="space-y-2">
					<label class="text-sm font-semibold text-on-surface" for="team-email">Email</label>
					<input
						id="team-email"
						name="email"
						type="email"
						bind:value={inviteEmail}
						class="input-base"
						placeholder="name@example.com"
						autocomplete="off"
						required
					/>
				</div>

				<div class="space-y-2">
					<p class="text-sm font-semibold text-on-surface">Role</p>
					<div class="flex gap-3">
						<label
							class="flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm {inviteRole === 'moderator'
								? 'border-primary bg-primary/5 font-semibold text-primary'
								: 'border-sand text-on-surface-variant'}"
						>
							<input type="radio" bind:group={inviteRole} name="role" value="moderator" class="accent-primary" />
							Moderator
						</label>
						<label
							class="flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm {inviteRole === 'guide'
								? 'border-primary bg-primary/5 font-semibold text-primary'
								: 'border-sand text-on-surface-variant'}"
						>
							<input type="radio" bind:group={inviteRole} name="role" value="guide" class="accent-primary" />
							Guide
						</label>
					</div>
				</div>

				{#if inviteRole === 'moderator'}
					<div class="rounded-[24px] border border-sand bg-background p-4">
						{#if matchedMember}
							<p class="section-eyebrow">Matching Member</p>
							<div class="mt-3 rounded-2xl border border-sand bg-surface px-4 py-3">
								<p class="text-sm font-semibold text-on-surface">{matchedMember.label}</p>
								<p class="text-xs text-on-surface-variant">{matchedMember.email}</p>
								<p class="mt-1 text-xs text-on-surface-variant">
									Member since {formatDate(matchedMember.joinedAt)} | Onboarding {matchedMember.onboardingComplete ? 'complete' : 'in progress'}
								</p>
							</div>
							<p class="mt-3 text-sm text-on-surface-variant">
								This will grant this person moderator access to the admin panel immediately.
							</p>
						{:else}
							<p class="section-eyebrow">Invite Flow</p>
							<p class="mt-3 text-sm leading-7 text-on-surface-variant">
								No existing member matches this email yet, so we will prepare an invite they can use to set their password and activate moderator access later.
							</p>
						{/if}
					</div>
				{/if}

				{#if inviteRole === 'guide'}
					<div class="space-y-4 rounded-[24px] border border-sand bg-background p-4">
						<p class="section-eyebrow">Guide Profile Details</p>
						<div class="space-y-2">
							<label class="text-sm font-semibold text-on-surface" for="guide-name">Display name</label>
							<input
								id="guide-name"
								name="guideName"
								type="text"
								bind:value={guideName}
								class="input-base"
								placeholder="Sarah Jenkins"
								autocomplete="off"
							/>
						</div>
						<div class="space-y-2">
							<label class="text-sm font-semibold text-on-surface" for="guide-title">Title</label>
							<input
								id="guide-title"
								name="guideTitle"
								type="text"
								bind:value={guideTitle}
								class="input-base"
								placeholder="Community Guide"
								autocomplete="off"
							/>
						</div>
					</div>
				{/if}

				{#if inviteError}
					<div class="rounded-3xl border border-red-200 bg-error px-4 py-3 text-sm text-error-strong">
						{inviteError}
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-2">
					<button type="button" class="button-secondary" onclick={closeModal}>Cancel</button>
					<button type="submit" class="button-primary" disabled={inviteSubmitting}>
						{#if inviteSubmitting}
							Updating...
						{:else if inviteRole === 'moderator' && matchedMember}
							Promote to moderator
						{:else if inviteRole === 'guide'}
							Create guide invite
						{:else}
							Create moderator invite
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
