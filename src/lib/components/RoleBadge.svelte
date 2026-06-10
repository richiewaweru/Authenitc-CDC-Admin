<script lang="ts">
	import type { AppRole } from '$lib/types';

	type Props = {
		role: AppRole;
	};

	let { role }: Props = $props();

	const tones: Record<AppRole, string> = {
		admin: 'bg-info text-info-strong',
		moderator: 'bg-warning/60 text-[#664D03]',
		guide: 'bg-success text-primary-dark',
		member: 'bg-sand text-on-surface'
	};
</script>

<span class={`badge ${tones[role]}`}>{role}</span>
