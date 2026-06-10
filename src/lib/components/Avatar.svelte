<script lang="ts">
	type Props = {
		initials: string;
		name: string;
		src?: string | null;
		size?: 'sm' | 'md' | 'lg';
	};

	let { initials, name, src = null, size = 'md' }: Props = $props();

	const sizes = {
		sm: 'h-9 w-9 text-xs',
		md: 'h-11 w-11 text-sm',
		lg: 'h-14 w-14 text-base'
	};
</script>

<div
	class={`flex ${sizes[size]} items-center justify-center overflow-hidden rounded-2xl border border-sand bg-primary/10 font-semibold text-primary-dark`}
	aria-label={name}
	title={name}
>
	{#if src}
		<img src={src} alt={name} class="h-full w-full object-cover" />
	{:else}
		<span>{initials}</span>
	{/if}
</div>
