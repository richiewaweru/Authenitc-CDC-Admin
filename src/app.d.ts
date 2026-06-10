import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import type { AppRole, Database, LayoutMode, SidebarItem, UserSummary } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			role: AppRole | null;
		}
		interface PageData {
			layoutMode: LayoutMode;
			session: Session | null;
			role: AppRole | null;
			user: UserSummary | null;
			navigation: SidebarItem[];
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
