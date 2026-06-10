<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import Avatar from '$lib/components/Avatar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RoleBadge from '$lib/components/RoleBadge.svelte';
	import { getSupabaseBrowserClient } from '$lib/supabase';
	import type { SidebarItem, StaffRole, UserSummary } from '$lib/types';

	type Props = {
		role: StaffRole;
		user: UserSummary;
		navigation: SidebarItem[];
		children: Snippet;
	};

	let { role, user, navigation, children }: Props = $props();

	const mobileItems = $derived(navigation.filter((item) => item.label !== 'Settings').slice(0, 5));
	const pathname = $derived(page.url.pathname);
	let isSigningOut = $state(false);

	const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

	async function signOut() {
		if (isSigningOut) {
			return;
		}

		isSigningOut = true;
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		await goto('/login', { invalidateAll: true, replaceState: true });
		isSigningOut = false;
	}
</script>

<div class="min-h-screen pb-24 md:pb-0">
	<div class="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-3 py-3 md:px-4 lg:px-6">
		<aside class="hidden w-[240px] shrink-0 rounded-[28px] bg-primary-dark p-5 text-on-primary md:flex md:flex-col">
			<div class="space-y-10">
				<div class="space-y-3">
					<div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 font-display text-2xl font-semibold">
						A
					</div>
					<div>
						<p class="font-display text-2xl font-semibold">Authentic</p>
						<p class="text-sm text-white/70">Admin control panel</p>
					</div>
				</div>

				<nav class="space-y-2">
					{#each navigation.filter((item) => item.label !== 'Settings') as item}
						<a
							href={item.href}
							class={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium ${
								isActive(item.href) ? 'bg-primary text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'
							}`}
						>
							<Icon name={item.icon} className="h-5 w-5" />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
			</div>

			<div class="mt-auto space-y-4">
				<a
					href="/settings"
					class={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium ${
						isActive('/settings') ? 'bg-primary text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'
					}`}
				>
					<Icon name="settings" className="h-5 w-5" />
					<span>Settings</span>
				</a>

				<div class="rounded-[24px] border border-white/12 bg-white/6 p-3">
					<div class="flex items-center gap-3">
						<Avatar initials={user.initials} name={user.displayName} size="md" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-white">{user.displayName}</p>
							<p class="truncate text-xs text-white/70">{user.email}</p>
						</div>
					</div>

					<div class="mt-4 flex items-center justify-between gap-3">
						<div class="rounded-full bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white">
							{role}
						</div>
						<button
							type="button"
							class="inline-flex items-center gap-2 rounded-full border border-white/14 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
							onclick={signOut}
						>
							<Icon name="logout" className="h-3.5 w-3.5" />
							<span>{isSigningOut ? 'Signing out' : 'Sign out'}</span>
						</button>
					</div>
				</div>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col gap-4">
			<header class="sticky top-3 z-20 rounded-[24px] border border-sand/90 bg-surface/95 px-4 py-3 backdrop-blur lg:px-6">
				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sand bg-background text-on-surface"
						aria-label="Notifications"
					>
						<Icon name="bell" className="h-5 w-5" />
						<span class="absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
					</button>

					<div class="relative min-w-[220px] flex-1">
						<Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
						<input
							type="search"
							class="input-base pl-11"
							placeholder="Search guides, bookings, members..."
						/>
					</div>

					<div class="ml-auto flex items-center gap-3">
						<div class="hidden items-center gap-3 rounded-2xl border border-sand bg-background px-3 py-2 sm:flex">
							<Avatar initials={user.initials} name={user.displayName} size="sm" />
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold text-on-surface">{user.displayName}</p>
								<p class="truncate text-xs text-on-surface-variant">{user.email}</p>
							</div>
						</div>
						<RoleBadge role={role} />
					</div>
				</div>
			</header>

			<main class="min-w-0 flex-1 rounded-[32px] border border-sand/70 bg-white/45 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
				{@render children()}
			</main>
		</div>
	</div>

	<nav class="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-sand bg-surface/95 p-2 shadow-lg backdrop-blur md:hidden">
		<div class="grid grid-cols-5 gap-1">
			{#each mobileItems as item}
				<a
					href={item.href}
					class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-semibold ${
						isActive(item.href) ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
					}`}
				>
					<Icon name={item.icon} className="h-4 w-4" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
