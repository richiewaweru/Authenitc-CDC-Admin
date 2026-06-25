/**
 * Default timezone for all slot operations.
 * Guides are US-based; default to Eastern time.
 * Handles EDT/EST transitions automatically via the OS timezone database.
 *
 * Future: read from guide_profiles.timezone when multi-timezone support is added.
 */
export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Converts a local date and time in a given timezone to a UTC ISO string.
 */
export function toUtcIsoString(
	dateKey: string,
	timeKey: string,
	timezone: string = DEFAULT_TIMEZONE
): string {
	const naiveUtcMs = Date.parse(`${dateKey}T${timeKey}:00.000Z`);

	if (Number.isNaN(naiveUtcMs)) {
		throw new Error(`Invalid date/time: ${dateKey}T${timeKey}`);
	}

	const formatted = new Intl.DateTimeFormat('sv-SE', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).format(new Date(naiveUtcMs));

	const apparentUtcMs = Date.parse(formatted.replace(' ', 'T') + '.000Z');
	const offsetMs = naiveUtcMs - apparentUtcMs;
	const correctUtcMs = naiveUtcMs + offsetMs;

	return new Date(correctUtcMs).toISOString();
}
