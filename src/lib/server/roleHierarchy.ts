import type { AppRole } from '../types/database';

const ROLE_RANK: Record<AppRole, number> = {
	member: 0,
	guide: 1,
	moderator: 2,
	admin: 3
};

export function getHigherRole(currentRole: AppRole | null | undefined, requestedRole: AppRole): AppRole {
	if (!currentRole) {
		return requestedRole;
	}

	return ROLE_RANK[currentRole] >= ROLE_RANK[requestedRole] ? currentRole : requestedRole;
}

export function shouldAssignGuideRole(currentRole: AppRole | null | undefined) {
	return getHigherRole(currentRole, 'guide') === 'guide';
}

export function shouldDemoteGuideProfileRemoval(currentRole: AppRole | null | undefined) {
	return currentRole === 'guide';
}
