<script lang="ts">
	import type { NavIconName } from '$lib/types';

	type Props = {
		name: NavIconName;
		className?: string;
	};

	let { name, className = '' }: Props = $props();
</script>

{#if name === 'home'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M3 10.5 12 3l9 7.5" />
		<path d="M5.5 9.5V21h13V9.5" />
	</svg>
{:else if name === 'guides'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
		<circle cx="9.5" cy="7" r="3.5" />
		<path d="M21 21v-2a4 4 0 0 0-3-3.87" />
		<path d="M16.5 3.2a3.5 3.5 0 0 1 0 7" />
	</svg>
{:else if name === 'events'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M8 2v4" />
		<path d="M16 2v4" />
		<rect x="3" y="5" width="18" height="16" rx="2" />
		<path d="M3 10h18" />
		<path d="M8 15h4" />
		<path d="M8 18h8" />
	</svg>
{:else if name === 'readings'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
		<path d="M9 7h7" />
		<path d="M9 11h5" />
	</svg>
{:else if name === 'announcements'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="m3 11 18-5v12L3 13v-2Z" />
		<path d="M11.5 14.5 13 21H8l-1.2-6" />
		<path d="M21 9v6" />
	</svg>
{:else if name === 'slots'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M8 2v4" />
		<path d="M16 2v4" />
		<rect x="3" y="5" width="18" height="16" rx="2" />
		<path d="M3 10h18" />
	</svg>
{:else if name === 'bookings'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M8 6h13" />
		<path d="M8 12h13" />
		<path d="M8 18h13" />
		<path d="M3 6h.01" />
		<path d="M3 12h.01" />
		<path d="M3 18h.01" />
	</svg>
{:else if name === 'members'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9.5" cy="7" r="4" />
		<path d="M23 21v-2a4 4 0 0 0-3.2-3.92" />
		<path d="M16.5 3.4a4 4 0 0 1 0 7.2" />
	</svg>
{:else if name === 'team'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="m12 3 7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" />
		<path d="m9.5 12 1.5 1.5 3.5-4" />
	</svg>
{:else if name === 'settings'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M12 3v2.5" />
		<path d="M12 18.5V21" />
		<path d="M4.93 4.93l1.77 1.77" />
		<path d="m17.3 17.3 1.77 1.77" />
		<path d="M3 12h2.5" />
		<path d="M18.5 12H21" />
		<path d="m4.93 19.07 1.77-1.77" />
		<path d="m17.3 6.7 1.77-1.77" />
		<circle cx="12" cy="12" r="4" />
	</svg>
{:else if name === 'search'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</svg>
{:else if name === 'bell'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
		<path d="M10 21a2 2 0 0 0 4 0" />
	</svg>
{:else if name === 'logout'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class={className}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="m16 17 5-5-5-5" />
		<path d="M21 12H9" />
	</svg>
{/if}
