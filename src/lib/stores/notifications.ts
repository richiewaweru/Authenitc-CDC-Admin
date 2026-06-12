import { writable } from 'svelte/store';

export type NotificationKind = 'booking' | 'payment' | 'onboarding' | 'team';
export type NotificationTone = 'info' | 'success' | 'warning';

export type AppNotification = {
	id: string;
	kind: NotificationKind;
	tone: NotificationTone;
	title: string;
	detail: string;
	href: string;
	createdAt: string;
	read: boolean;
};

const MAX_NOTIFICATIONS = 30;

function sortNotifications(notifications: AppNotification[]) {
	return [...notifications].sort(
		(left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
	);
}

function createNotificationStore() {
	const { subscribe, set, update } = writable<AppNotification[]>([]);

	return {
		subscribe,
		reset: () => set([]),
		push: (notification: AppNotification) =>
			update((current) =>
				sortNotifications([
					notification,
					...current.filter((existing) => existing.id !== notification.id)
				]).slice(0, MAX_NOTIFICATIONS)
			),
		markAllRead: () =>
			update((current) => current.map((notification) => ({ ...notification, read: true }))),
		markRead: (id: string) =>
			update((current) =>
				current.map((notification) =>
					notification.id === id ? { ...notification, read: true } : notification
				)
			)
	};
}

export const notificationStore = createNotificationStore();
