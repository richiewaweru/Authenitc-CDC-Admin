import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

import type { Database } from '$lib/types';

let adminClient:
	| ReturnType<typeof createClient<Database>>
	| undefined;

export function getSupabaseAdminClient() {
	if (!adminClient) {
		adminClient = createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
	}

	return adminClient;
}
