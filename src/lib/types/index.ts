import type { User } from '@supabase/supabase-js';

import type { AppRole } from './database';

export type { AppRole, BookingStatus, Database, PaymentStatus, UserState } from './database';

export type StaffRole = Exclude<AppRole, 'member'>;
export type LayoutMode = 'app' | 'plain';
export type NavIconName =
	| 'home'
	| 'guides'
	| 'slots'
	| 'bookings'
	| 'members'
	| 'team'
	| 'settings'
	| 'search'
	| 'bell'
	| 'logout';

export type SidebarItem = {
	label: string;
	href: string;
	icon: NavIconName;
	roles: StaffRole[];
	description: string;
};

export type UserSummary = {
	id: string;
	email: string;
	displayName: string;
	initials: string;
};

export const STAFF_ROLES: StaffRole[] = ['admin', 'moderator', 'guide'];

export const SIDEBAR_ITEMS: SidebarItem[] = [
	{
		label: 'Home',
		href: '/',
		icon: 'home',
		roles: ['admin', 'moderator', 'guide'],
		description: 'Overview and daily signals'
	},
	{
		label: 'Guides',
		href: '/guides',
		icon: 'guides',
		roles: ['admin', 'moderator'],
		description: 'Manage guide profiles'
	},
	{
		label: 'Slots',
		href: '/slots',
		icon: 'slots',
		roles: ['admin', 'moderator', 'guide'],
		description: 'Availability and calendars'
	},
	{
		label: 'Bookings',
		href: '/bookings',
		icon: 'bookings',
		roles: ['admin', 'moderator', 'guide'],
		description: 'Conversations and payments'
	},
	{
		label: 'Members',
		href: '/members',
		icon: 'members',
		roles: ['admin', 'moderator', 'guide'],
		description: 'People and profiles'
	},
	{
		label: 'Team',
		href: '/team',
		icon: 'team',
		roles: ['admin'],
		description: 'Admins, moderators, and invites'
	},
	{
		label: 'Settings',
		href: '/settings',
		icon: 'settings',
		roles: ['admin', 'moderator', 'guide'],
		description: 'Profile and environment settings'
	}
];

export function isStaffRole(role: AppRole | null | undefined): role is StaffRole {
	return !!role && STAFF_ROLES.includes(role as StaffRole);
}

export function isAdminRole(role: AppRole | null | undefined): role is 'admin' {
	return role === 'admin';
}

export function getVisibleSidebarItems(role: AppRole | null | undefined): SidebarItem[] {
	if (!isStaffRole(role)) {
		return [];
	}

	return SIDEBAR_ITEMS.filter((item) => item.roles.includes(role));
}

export function getUserSummary(user: User): UserSummary {
	const rawName =
		typeof user.user_metadata?.display_name === 'string'
			? user.user_metadata.display_name
			: typeof user.user_metadata?.full_name === 'string'
				? user.user_metadata.full_name
				: typeof user.user_metadata?.name === 'string'
					? user.user_metadata.name
					: user.email?.split('@')[0] ?? 'Staff member';

	const displayName = rawName
		.split(/[._-]/g)
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');

	const initials = displayName
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('');

	return {
		id: user.id,
		email: user.email ?? 'unknown@authentic.app',
		displayName,
		initials: initials || 'AU'
	};
}
