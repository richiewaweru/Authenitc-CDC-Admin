import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

import type { Database } from '$lib/types';

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient() {
	if (!browserClient) {
		browserClient = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			isSingleton: true
		});
	}

	return browserClient;
}
