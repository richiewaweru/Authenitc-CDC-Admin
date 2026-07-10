# Email Template Variable Audit
Date: 2026-07-10
Auditor: Codex
Method: Mixed: Resend Templates API for hosted Resend HTML/text; Supabase Management API for Auth config; local filesystem scan for repo templates and Edge Functions. Supabase Auth variable support was validated against the official Supabase Email Templates documentation.

## Summary
- Resend templates audited: 15
- Supabase Auth templates audited: 14
- Repo HTML templates audited: 1
- Edge Function sender call sites: 11
- CRITICAL issues: 11
- WARN issues: 0
- INFO flags: 7

## Post-fix verification
Live Resend templates were patched and published on 2026-07-10 to standardize uppercase text-body tokens to the camelCase names sent by the Edge Functions.

Verification result after patch:
- CRITICAL issues: 0
- WARN issues: 2
- Remaining warnings:
  - `TEMPLATE_STAFF_TIME_REQUEST` / `new-time-request`: code still passes `firstName`, but the template does not reference it.
  - `TEMPLATE_MEMBER_REMINDER_24H` / `member-reminder-24h`: code still passes `meetingLink`, but the template does not reference it.
- INFO flags still require rendered-email click testing for href-embedded variables.

Patched live Resend templates:
- `welcome-email`: `FIRSTNAME` -> `firstName`
- `alignment-profile`: `FIRSTNAME` -> `firstName`
- `alignment-conversation`: `FIRSTNAME` -> `firstName`
- `booking-cancelled`: `FIRSTNAME` -> `firstName`
- `member-alignment-ready`: `FIRSTNAME` -> `firstName`
- `conversation-booked`: `FIRSTNAME` -> `firstName`
- `new-booking-notification`: `FIRSTNAME` -> `firstName`
- `new-time-request`: `MEMBERNAME` -> `memberName`
- `alignment-conversation-4`: `FIRSTNAME` -> `firstName`
- `member-reminder-24h`: `FIRSTNAME` -> `firstName`
- `member-reminder-1h`: `FIRSTNAME` -> `firstName`

## Critical issues (will cause runtime failures)
| Surface | Template/code path | Issue | Recommended fix |
|---|---|---|---|
| Resend | TEMPLATE_MEMBER_WELCOME / welcome-email | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName. |
| Resend | TEMPLATE_MEMBER_ONBOARDING / alignment-profile | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName. |
| Resend | TEMPLATE_MEMBER_MEETING_LINK / alignment-conversation | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, guideName, slotDate, slotTime, meetingLink. |
| Resend | TEMPLATE_MEMBER_CANCELLED / booking-cancelled | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, guideName, slotDate, slotTime, bookNewTimeUrl. |
| Resend | TEMPLATE_STAFF_ONBOARDING / member-alignment-ready | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, memberName, memberEmail, memberCity, memberProfileUrl. |
| Resend | TEMPLATE_MEMBER_BOOKING / conversation-booked | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, guideName, guideTitle, slotDate, slotTime, durationMinutes, calendarUrl. |
| Resend | TEMPLATE_STAFF_BOOKING / new-booking-notification | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, memberName, memberEmail, guideName, slotDate, slotTime, durationMinutes, bookingUrl. |
| Resend | TEMPLATE_STAFF_TIME_REQUEST / new-time-request | Missing: MEMBERNAME Case: MEMBERNAME vs memberName | Standardize template tokens to camelCase matching code: firstName, memberName, memberEmail, preferredGuideName, preferredWindow, note, memberProfileUrl. |
| Resend | TEMPLATE_MEMBER_TIME_REQUEST_ACK / alignment-conversation-4 | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName. |
| Resend | TEMPLATE_MEMBER_REMINDER_24H / member-reminder-24h | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, guideName, slotDate, slotTime, meetingLink. |
| Resend | TEMPLATE_MEMBER_REMINDER_1H / member-reminder-1h | Missing: FIRSTNAME Case: FIRSTNAME vs firstName | Standardize template tokens to camelCase matching code: firstName, guideName, slotTime, meetingLink. |

## Warnings (silent drift, not breaking)
None found.

## Info flags (manual verification recommended)
| Template env var | Alias | href-embedded vars | Note |
|---|---|---|---|
| TEMPLATE_MEMBER_MEETING_LINK | alignment-conversation | meetingLink | Send a real test email and click the rendered link. |
| TEMPLATE_MEMBER_CANCELLED | booking-cancelled | bookNewTimeUrl | Send a real test email and click the rendered link. |
| TEMPLATE_STAFF_ONBOARDING | member-alignment-ready | memberProfileUrl | Send a real test email and click the rendered link. |
| TEMPLATE_MEMBER_BOOKING | conversation-booked | calendarUrl | Send a real test email and click the rendered link. |
| TEMPLATE_STAFF_BOOKING | new-booking-notification | bookingUrl | Send a real test email and click the rendered link. |
| TEMPLATE_STAFF_TIME_REQUEST | new-time-request | memberProfileUrl | Send a real test email and click the rendered link. |
| TEMPLATE_MEMBER_REMINDER_1H | member-reminder-1h | meetingLink | Send a real test email and click the rendered link. |

## Detailed matrix - Resend templates
| Severity | Template env var | UUID | Alias | Code location | Tokens in HTML/text | Vars passed in code | Missing in code | Extra in code | Case mismatches | href-embedded vars |
|---|---|---|---|---|---|---|---|---|---|---|
| CRITICAL | TEMPLATE_MEMBER_WELCOME | f284400d-232c-4a65-b192-55c6b6b20c78 | welcome-email | supabase/functions/send-member-email/index.ts:93 (welcome branch) | FIRSTNAME, firstName | firstName | FIRSTNAME | - | FIRSTNAME vs firstName | - |
| CRITICAL | TEMPLATE_MEMBER_ONBOARDING | a4dccb22-7f9c-4192-a6d8-43a2dec1140d | alignment-profile | supabase/functions/send-member-email/index.ts:98 (onboarding_complete member email) | FIRSTNAME, firstName | firstName | FIRSTNAME | - | FIRSTNAME vs firstName | - |
| CRITICAL | TEMPLATE_MEMBER_MEETING_LINK | dbb92daa-2574-420f-8f2f-75ed8a9c6017 | alignment-conversation | supabase/functions/send-member-email/index.ts:103 (meeting_link_ready branch) | FIRSTNAME, firstName, guideName, meetingLink, slotDate, slotTime | firstName, guideName, slotDate, slotTime, meetingLink | FIRSTNAME | - | FIRSTNAME vs firstName | meetingLink |
| CRITICAL | TEMPLATE_MEMBER_CANCELLED | 431707e3-321e-4d5a-89c1-9860df62cb3f | booking-cancelled | supabase/functions/send-member-email/index.ts:115 (booking_cancelled branch) | FIRSTNAME, bookNewTimeUrl, firstName, guideName, slotDate, slotTime | firstName, guideName, slotDate, slotTime, bookNewTimeUrl | FIRSTNAME | - | FIRSTNAME vs firstName | bookNewTimeUrl |
| CRITICAL | TEMPLATE_STAFF_ONBOARDING | bca9c46f-726b-40f0-969d-ba9162a3f248 | member-alignment-ready | supabase/functions/send-member-email/index.ts:144 (onboarding_complete staff notification) | FIRSTNAME, firstName, memberCity, memberEmail, memberName, memberProfileUrl | firstName, memberName, memberEmail, memberCity, memberProfileUrl | FIRSTNAME | - | FIRSTNAME vs firstName | memberProfileUrl |
| CRITICAL | TEMPLATE_MEMBER_BOOKING | 5efbba55-028e-4fad-8bcb-f0fb55385a64 | conversation-booked | supabase/functions/send-booking-confirmation/index.ts:83 (member booking confirmation) | FIRSTNAME, calendarUrl, durationMinutes, firstName, guideName, guideTitle, slotDate, slotTime | firstName, guideName, guideTitle, slotDate, slotTime, durationMinutes, calendarUrl | FIRSTNAME | - | FIRSTNAME vs firstName | calendarUrl |
| CRITICAL | TEMPLATE_STAFF_BOOKING | c13160a2-fb14-4d2b-aa07-caf2e3cd5013 | new-booking-notification | supabase/functions/send-booking-confirmation/index.ts:84 (staff booking notification) | FIRSTNAME, bookingUrl, durationMinutes, firstName, guideName, memberEmail, memberName, slotDate, slotTime | firstName, memberName, memberEmail, guideName, slotDate, slotTime, durationMinutes, bookingUrl | FIRSTNAME | - | FIRSTNAME vs firstName | bookingUrl |
| CRITICAL | TEMPLATE_STAFF_TIME_REQUEST | f94dd1ff-9a25-434c-952f-a94aacf685e4 | new-time-request | supabase/functions/request-slot-contact/index.ts:212 (staff time request) | MEMBERNAME, memberEmail, memberName, memberProfileUrl, note, preferredGuideName, preferredWindow | firstName, memberName, memberEmail, preferredGuideName, preferredWindow, note, memberProfileUrl | MEMBERNAME | firstName | MEMBERNAME vs memberName | memberProfileUrl |
| CRITICAL | TEMPLATE_MEMBER_TIME_REQUEST_ACK | 1b55bc6f-ce03-4796-923d-59ba8af55f8d | alignment-conversation-4 | supabase/functions/request-slot-contact/index.ts:213 (member time request acknowledgement) | FIRSTNAME, firstName | firstName | FIRSTNAME | - | FIRSTNAME vs firstName | - |
| CRITICAL | TEMPLATE_MEMBER_REMINDER_24H | 8dd7cbb7-833f-4b51-abda-b3223a4cfdcf | member-reminder-24h | supabase/functions/send-meeting-reminder/index.ts:122 (24h reminder) | FIRSTNAME, firstName, guideName, slotDate, slotTime | firstName, guideName, slotDate, slotTime, meetingLink | FIRSTNAME | meetingLink | FIRSTNAME vs firstName | - |
| CRITICAL | TEMPLATE_MEMBER_REMINDER_1H | 71379a23-dd15-432b-a56a-afea41b9f3b6 | member-reminder-1h | supabase/functions/send-meeting-reminder/index.ts:123 (1h reminder) | FIRSTNAME, firstName, guideName, meetingLink, slotTime | firstName, guideName, slotTime, meetingLink | FIRSTNAME | - | FIRSTNAME vs firstName | meetingLink |

## Detailed matrix - Supabase Auth templates
| Severity | Template | Fields returned | Tokens | Unsupported tokens |
|---|---|---|---|---|
| OK | confirmation | content | .ConfirmationURL, .Email, .SiteURL | - |
| OK | custom | contents | - | - |
| OK | email_change | content | .ConfirmationURL, .NewEmail | - |
| OK | email_changed_notification | content | .Email, .OldEmail | - |
| OK | identity_linked_notification | content | .Email, .Provider | - |
| OK | identity_unlinked_notification | content | .Email, .Provider | - |
| OK | invite | content | .ConfirmationURL, .Email, .SiteURL | - |
| OK | magic_link | content | .ConfirmationURL | - |
| OK | mfa_factor_enrolled_notification | content | .FactorType | - |
| OK | mfa_factor_unenrolled_notification | content | .FactorType | - |
| OK | password_changed_notification | content | - | - |
| OK | phone_changed_notification | content | .OldPhone, .Phone | - |
| OK | reauthentication | content | .Token | - |
| OK | recovery | content | .ConfirmationURL | - |

## Repo HTML templates
| File | Tokens | href tokens | Mapping |
|---|---|---|---|
| supabase/email-templates/member-booking-cancelled.html | bookNewTimeUrl, firstName, guideName, slotDate, slotTime | bookNewTimeUrl | Historical/live copy for booking-cancelled. Live Resend alias: booking-cancelled. |

## Recommended fixes
- welcome-email: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName.
- alignment-profile: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName.
- alignment-conversation: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, guideName, slotDate, slotTime, meetingLink.
- booking-cancelled: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, guideName, slotDate, slotTime, bookNewTimeUrl.
- member-alignment-ready: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, memberName, memberEmail, memberCity, memberProfileUrl.
- conversation-booked: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, guideName, guideTitle, slotDate, slotTime, durationMinutes, calendarUrl.
- new-booking-notification: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, memberName, memberEmail, guideName, slotDate, slotTime, durationMinutes, bookingUrl.
- new-time-request: change template token(s) MEMBERNAME, MEMBERNAME vs memberName to the existing camelCase code variables: firstName, memberName, memberEmail, preferredGuideName, preferredWindow, note, memberProfileUrl.
- alignment-conversation-4: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName.
- member-reminder-24h: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, guideName, slotDate, slotTime, meetingLink.
- member-reminder-1h: change template token(s) FIRSTNAME, FIRSTNAME vs firstName to the existing camelCase code variables: firstName, guideName, slotTime, meetingLink.
- alignment-conversation: manually verify rendered href variable(s) meetingLink by sending a real email and clicking the link.
- booking-cancelled: manually verify rendered href variable(s) bookNewTimeUrl by sending a real email and clicking the link.
- member-alignment-ready: manually verify rendered href variable(s) memberProfileUrl by sending a real email and clicking the link.
- conversation-booked: manually verify rendered href variable(s) calendarUrl by sending a real email and clicking the link.
- new-booking-notification: manually verify rendered href variable(s) bookingUrl by sending a real email and clicking the link.
- new-time-request: manually verify rendered href variable(s) memberProfileUrl by sending a real email and clicking the link.
- member-reminder-1h: manually verify rendered href variable(s) meetingLink by sending a real email and clicking the link.

## Appendix
### Raw token lists per Resend template
| Alias | UUID | HTML tokens | Text tokens | API variable metadata | href tokens |
|---|---|---|---|---|---|
| alignment-conversation | dbb92daa-2574-420f-8f2f-75ed8a9c6017 | firstName, guideName, meetingLink, slotDate, slotTime | FIRSTNAME, guideName, meetingLink, slotDate, slotTime | - | meetingLink |
| alignment-conversation-4 | 1b55bc6f-ce03-4796-923d-59ba8af55f8d | firstName | FIRSTNAME | - | - |
| alignment-profile | a4dccb22-7f9c-4192-a6d8-43a2dec1140d | firstName | FIRSTNAME | FIRSTNAME, firstName | - |
| booking-cancelled | 431707e3-321e-4d5a-89c1-9860df62cb3f | bookNewTimeUrl, firstName, guideName, slotDate, slotTime | FIRSTNAME, bookNewTimeUrl, guideName, slotDate, slotTime | FIRSTNAME, bookNewTimeUrl, firstName, guideName, slotDate, slotTime | bookNewTimeUrl |
| confirm-email | a854df3f-0771-4d27-8c31-015c1baede45 | .ConfirmationURL, .Email | .ConfirmationURL, .Email | - | .ConfirmationURL |
| conversation-booked | 5efbba55-028e-4fad-8bcb-f0fb55385a64 | calendarUrl, durationMinutes, firstName, guideName, guideTitle, slotDate, slotTime | FIRSTNAME, calendarUrl, durationMinutes, guideName, guideTitle, slotDate, slotTime | - | calendarUrl |
| member-alignment-ready | bca9c46f-726b-40f0-969d-ba9162a3f248 | firstName, memberCity, memberEmail, memberName, memberProfileUrl | FIRSTNAME, memberCity, memberEmail, memberName, memberProfileUrl | - | memberProfileUrl |
| member-reminder-1h | 71379a23-dd15-432b-a56a-afea41b9f3b6 | firstName, guideName, meetingLink, slotTime | FIRSTNAME, guideName, meetingLink, slotTime | - | meetingLink |
| member-reminder-24h | 8dd7cbb7-833f-4b51-abda-b3223a4cfdcf | firstName, guideName, slotDate, slotTime | FIRSTNAME, guideName, slotDate, slotTime | FIRSTNAME, firstName, guideName, slotDate, slotTime | - |
| new-booking-notification | c13160a2-fb14-4d2b-aa07-caf2e3cd5013 | bookingUrl, durationMinutes, firstName, guideName, memberEmail, memberName, slotDate, slotTime | FIRSTNAME, bookingUrl, durationMinutes, guideName, memberEmail, memberName, slotDate, slotTime | - | bookingUrl |
| new-time-request | f94dd1ff-9a25-434c-952f-a94aacf685e4 | memberEmail, memberName, memberProfileUrl, note, preferredGuideName, preferredWindow | MEMBERNAME, memberEmail, memberName, memberProfileUrl, note, preferredGuideName, preferredWindow | - | memberProfileUrl |
| payment-confirmation | 1ecd1441-9b1b-4a8c-8beb-bb79c9afb890 | amountPaid, firstName, guideName, slotDate | FIRSTNAME, amountPaid, guideName, slotDate | FIRSTNAME, amountPaid, firstName, guideName, slotDate | - |
| payment-failed | 0aca567a-3c72-44e1-9b65-dfea7b407ed8 | firstName, guideName, slotDate | FIRSTNAME, guideName, slotDate | FIRSTNAME, firstName, guideName, slotDate | - |
| team-invite | cd414526-383c-4adf-a1fb-69aee9b66959 | .ConfirmationURL, .Email | .ConfirmationURL, .Email | - | .ConfirmationURL |
| welcome-email | f284400d-232c-4a65-b192-55c6b6b20c78 | firstName | FIRSTNAME | FIRSTNAME, firstName | - |

### Raw variable lists per code call site
| File | Code path | Template env var | Variables |
|---|---|---|---|
| supabase/functions/send-member-email/index.ts:93 | welcome branch | TEMPLATE_MEMBER_WELCOME | firstName |
| supabase/functions/send-member-email/index.ts:98 | onboarding_complete member email | TEMPLATE_MEMBER_ONBOARDING | firstName |
| supabase/functions/send-member-email/index.ts:103 | meeting_link_ready branch | TEMPLATE_MEMBER_MEETING_LINK | firstName, guideName, slotDate, slotTime, meetingLink |
| supabase/functions/send-member-email/index.ts:115 | booking_cancelled branch | TEMPLATE_MEMBER_CANCELLED | firstName, guideName, slotDate, slotTime, bookNewTimeUrl |
| supabase/functions/send-member-email/index.ts:144 | onboarding_complete staff notification | TEMPLATE_STAFF_ONBOARDING | firstName, memberName, memberEmail, memberCity, memberProfileUrl |
| supabase/functions/send-booking-confirmation/index.ts:83 | member booking confirmation | TEMPLATE_MEMBER_BOOKING | firstName, guideName, guideTitle, slotDate, slotTime, durationMinutes, calendarUrl |
| supabase/functions/send-booking-confirmation/index.ts:84 | staff booking notification | TEMPLATE_STAFF_BOOKING | firstName, memberName, memberEmail, guideName, slotDate, slotTime, durationMinutes, bookingUrl |
| supabase/functions/request-slot-contact/index.ts:212 | staff time request | TEMPLATE_STAFF_TIME_REQUEST | firstName, memberName, memberEmail, preferredGuideName, preferredWindow, note, memberProfileUrl |
| supabase/functions/request-slot-contact/index.ts:213 | member time request acknowledgement | TEMPLATE_MEMBER_TIME_REQUEST_ACK | firstName |
| supabase/functions/send-meeting-reminder/index.ts:122 | 24h reminder | TEMPLATE_MEMBER_REMINDER_24H | firstName, guideName, slotDate, slotTime, meetingLink |
| supabase/functions/send-meeting-reminder/index.ts:123 | 1h reminder | TEMPLATE_MEMBER_REMINDER_1H | firstName, guideName, slotTime, meetingLink |

### Template env var mapping method
- `supabase secrets list` confirmed every `TEMPLATE_*` name exists but returns hashed values only, not UUIDs.
- UUID mapping was resolved by live Resend template alias/name and code-path semantics, then every mapped UUID was fetched through the Resend Templates API.
- Payment templates exist as Supabase secrets and Resend templates but are not referenced by the current Edge Function sender code found in this repo.

### Supabase Auth config fields inspected
- Auth config keys matching template/email/mailer patterns: external_apple_email_optional, external_azure_email_optional, external_bitbucket_email_optional, external_discord_email_optional, external_email_enabled, external_facebook_email_optional, external_figma_email_optional, external_github_email_optional, external_gitlab_email_optional, external_google_email_optional, external_kakao_email_optional, external_keycloak_email_optional, external_linkedin_oidc_email_optional, external_notion_email_optional, external_slack_email_optional, external_slack_oidc_email_optional, external_spotify_email_optional, external_twitch_email_optional, external_twitter_email_optional, external_x_email_optional, external_zoom_email_optional, hook_send_email_enabled, hook_send_email_secrets, hook_send_email_uri, mailer_allow_unverified_email_sign_ins, mailer_autoconfirm, mailer_notifications_email_changed_enabled, mailer_notifications_identity_linked_enabled, mailer_notifications_identity_unlinked_enabled, mailer_notifications_mfa_factor_enrolled_enabled, mailer_notifications_mfa_factor_unenrolled_enabled, mailer_notifications_password_changed_enabled, mailer_notifications_phone_changed_enabled, mailer_otp_exp, mailer_otp_length, mailer_secure_email_change_enabled, mailer_subjects_confirmation, mailer_subjects_custom_contents, mailer_subjects_email_change, mailer_subjects_email_changed_notification, mailer_subjects_identity_linked_notification, mailer_subjects_identity_unlinked_notification, mailer_subjects_invite, mailer_subjects_magic_link, mailer_subjects_mfa_factor_enrolled_notification, mailer_subjects_mfa_factor_unenrolled_notification, mailer_subjects_password_changed_notification, mailer_subjects_phone_changed_notification, mailer_subjects_reauthentication, mailer_subjects_recovery, mailer_templates_confirmation_content, mailer_templates_custom_contents, mailer_templates_email_change_content, mailer_templates_email_changed_notification_content, mailer_templates_identity_linked_notification_content, mailer_templates_identity_unlinked_notification_content, mailer_templates_invite_content, mailer_templates_magic_link_content, mailer_templates_mfa_factor_enrolled_notification_content, mailer_templates_mfa_factor_unenrolled_notification_content, mailer_templates_password_changed_notification_content, mailer_templates_phone_changed_notification_content, mailer_templates_reauthentication_content, mailer_templates_recovery_content, mfa_phone_template, rate_limit_email_sent, sms_template, sms_twilio_content_sid, smtp_admin_email
