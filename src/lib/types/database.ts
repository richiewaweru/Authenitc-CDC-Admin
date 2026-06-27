export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					email: string | null;
					first_name: string | null;
					last_name: string | null;
					display_name: string | null;
					date_of_birth: string | null;
					gender: string | null;
					city_state: string | null;
					bio: string | null;
					avatar_url: string | null;
					expo_push_token: string | null;
					role: AppRole;
					suspended: boolean;
					onboarding_complete: boolean | null;
					user_state: UserState | null;
					last_sign_in_at: string | null;
					created_at: string | null;
					updated_at: string | null;
				};
				Insert: {
					id?: string;
					email?: string | null;
					first_name?: string | null;
					last_name?: string | null;
					display_name?: string | null;
					date_of_birth?: string | null;
					gender?: string | null;
					city_state?: string | null;
					bio?: string | null;
					avatar_url?: string | null;
					expo_push_token?: string | null;
					role?: AppRole;
					suspended?: boolean;
					onboarding_complete?: boolean | null;
					user_state?: UserState | null;
					last_sign_in_at?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
				Update: {
					email?: string | null;
					first_name?: string | null;
					last_name?: string | null;
					display_name?: string | null;
					date_of_birth?: string | null;
					gender?: string | null;
					city_state?: string | null;
					bio?: string | null;
					avatar_url?: string | null;
					expo_push_token?: string | null;
					role?: AppRole;
					suspended?: boolean;
					onboarding_complete?: boolean | null;
					user_state?: UserState | null;
					last_sign_in_at?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			guide_profiles: {
				Row: {
					id: string;
					user_id: string | null;
					email: string | null;
					name: string | null;
					display_name: string | null;
					title: string | null;
					avatar_url: string | null;
					initials: string | null;
					is_active: boolean;
					created_at: string | null;
					updated_at: string | null;
					created_by: string | null;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					email?: string | null;
					name?: string | null;
					display_name?: string | null;
					title?: string | null;
					avatar_url?: string | null;
					initials?: string | null;
					is_active?: boolean;
					created_at?: string | null;
					updated_at?: string | null;
					created_by?: string | null;
				};
				Update: {
					user_id?: string | null;
					email?: string | null;
					name?: string | null;
					display_name?: string | null;
					title?: string | null;
					avatar_url?: string | null;
					initials?: string | null;
					is_active?: boolean;
					created_at?: string | null;
					updated_at?: string | null;
					created_by?: string | null;
				};
				Relationships: [];
			};
			available_slots: {
				Row: {
					id: string;
					guide_id: string;
					slot_date: string | null;
					slot_time: string | null;
					starts_at: string | null;
					duration_minutes: number | null;
					status: SlotStatus | null;
					booked_by: string | null;
					booked_at: string | null;
					created_at: string | null;
					created_by: string | null;
					modified_by: string | null;
				};
				Insert: {
					id?: string;
					guide_id: string;
					slot_date?: string | null;
					slot_time?: string | null;
					starts_at?: string | null;
					duration_minutes?: number | null;
					status?: SlotStatus | null;
					booked_by?: string | null;
					booked_at?: string | null;
					created_at?: string | null;
					created_by?: string | null;
					modified_by?: string | null;
				};
				Update: {
					guide_id?: string;
					slot_date?: string | null;
					slot_time?: string | null;
					starts_at?: string | null;
					duration_minutes?: number | null;
					status?: SlotStatus | null;
					booked_by?: string | null;
					booked_at?: string | null;
					created_at?: string | null;
					created_by?: string | null;
					modified_by?: string | null;
				};
				Relationships: [];
			};
			bookings: {
				Row: {
					id: string;
					user_id: string;
					guide_id: string;
					slot_id: string;
					slot_date: string | null;
					slot_time: string | null;
					duration_minutes: number | null;
					meeting_link: string | null;
					status: BookingStatus | null;
					payment_status: PaymentStatus | null;
					stripe_payment_intent_id: string | null;
					amount_paid: number | null;
					currency: string | null;
					cancelled_at: string | null;
					cancel_reason: string | null;
					created_at: string | null;
					updated_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					guide_id: string;
					slot_id: string;
					slot_date?: string | null;
					slot_time?: string | null;
					duration_minutes?: number | null;
					meeting_link?: string | null;
					status?: BookingStatus | null;
					payment_status?: PaymentStatus | null;
					stripe_payment_intent_id?: string | null;
					amount_paid?: number | null;
					currency?: string | null;
					cancelled_at?: string | null;
					cancel_reason?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
				Update: {
					user_id?: string;
					guide_id?: string;
					slot_id?: string;
					slot_date?: string | null;
					slot_time?: string | null;
					duration_minutes?: number | null;
					meeting_link?: string | null;
					status?: BookingStatus | null;
					payment_status?: PaymentStatus | null;
					stripe_payment_intent_id?: string | null;
					amount_paid?: number | null;
					currency?: string | null;
					cancelled_at?: string | null;
					cancel_reason?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
			};
			onboarding_responses: {
				Row: {
					id: string;
					user_id: string;
					relationship_goal: string | null;
					communication_style: string | null;
					conflict_style: string | null;
					lifestyle_vision: string | null;
					shared_faith: string | null;
					church_involvement: string | null;
					future_hopes: string | null;
					authentic_meaning: string | null;
					created_at: string | null;
					updated_at: string | null;
					[key: string]: Json | string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					relationship_goal?: string | null;
					communication_style?: string | null;
					conflict_style?: string | null;
					lifestyle_vision?: string | null;
					shared_faith?: string | null;
					church_involvement?: string | null;
					future_hopes?: string | null;
					authentic_meaning?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
					[key: string]: Json | string | null | undefined;
				};
				Update: {
					id?: string;
					user_id?: string;
					relationship_goal?: string | null;
					communication_style?: string | null;
					conflict_style?: string | null;
					lifestyle_vision?: string | null;
					shared_faith?: string | null;
					church_involvement?: string | null;
					future_hopes?: string | null;
					authentic_meaning?: string | null;
					created_at?: string | null;
					updated_at?: string | null;
					[key: string]: Json | string | null | undefined;
				};
				Relationships: [];
			};
			preferences: {
				Row: {
					id: string;
					user_id: string;
					created_at: string | null;
					updated_at: string | null;
					[key: string]: Json | string | null;
				};
				Insert: Record<string, Json | string | null>;
				Update: Record<string, Json | string | null>;
				Relationships: [];
			};
			invites: {
				Row: {
					id: string;
					email: string;
					role: AppRole;
					invited_by: string;
					accepted_at: string | null;
					created_at: string | null;
				};
				Insert: {
					id?: string;
					email: string;
					role: AppRole;
					invited_by: string;
					accepted_at?: string | null;
					created_at?: string | null;
				};
				Update: {
					email?: string;
					role?: AppRole;
					invited_by?: string;
					accepted_at?: string | null;
					created_at?: string | null;
				};
				Relationships: [];
			};
			staff_notifications: {
				Row: {
					id: string;
					recipient_id: string;
					kind: 'booking' | 'payment' | 'onboarding' | 'team' | 'slot' | 'reminder';
					tone: 'info' | 'success' | 'warning';
					title: string;
					detail: string;
					href: string;
					read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					recipient_id: string;
					kind: 'booking' | 'payment' | 'onboarding' | 'team' | 'slot' | 'reminder';
					tone: 'info' | 'success' | 'warning';
					title: string;
					detail: string;
					href?: string;
					read?: boolean;
					created_at?: string;
				};
				Update: {
					read?: boolean;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			get_my_role: {
				Args: Record<PropertyKey, never>;
				Returns: AppRole | null;
			};
			get_my_guide_id: {
				Args: Record<PropertyKey, never>;
				Returns: string | null;
			};
		};
		Enums: {
			app_role: AppRole;
		};
		CompositeTypes: Record<string, never>;
	};
};

export type AppRole = 'admin' | 'moderator' | 'guide' | 'member';
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export type SlotStatus = 'open' | 'booked' | 'completed' | 'cancelled' | 'expired';
export type UserState =
	| 'authenticated'
	| 'onboarding_incomplete'
	| 'onboarding_complete'
	| 'conversation_complete'
	| 'conversation_scheduled'
	| 'conversation_approved'
	| 'community_active'
	| 'membership_active'
	| 'bylaws_accepted'
	| 'full_member';
