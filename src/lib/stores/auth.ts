import { writable } from 'svelte/store';

import type { Session } from '@supabase/supabase-js';

import type { AppRole, UserSummary } from '$lib/types';

export type AuthState = {
	session: Session | null;
	role: AppRole | null;
	user: UserSummary | null;
};

const initialState: AuthState = {
	session: null,
	role: null,
	user: null
};

export const authStore = writable<AuthState>(initialState);

export function setAuthState(state: AuthState) {
	authStore.set(state);
}
