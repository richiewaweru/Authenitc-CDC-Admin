import test from 'node:test';
import assert from 'node:assert/strict';

import { getHigherRole, shouldDemoteGuideProfileRemoval } from './roleHierarchy.ts';

function simulateGuideProfileSync(currentRole: 'admin' | 'moderator' | 'guide' | 'member' | null) {
	return {
		nextRole: getHigherRole(currentRole, 'guide'),
		guideProfileCreated: true
	};
}

test('syncGuideProfile simulation preserves admin role while still creating the guide profile', () => {
	const result = simulateGuideProfileSync('admin');

	assert.equal(result.nextRole, 'admin');
	assert.equal(result.guideProfileCreated, true);
});

test('syncGuideProfile simulation preserves moderator role while still creating the guide profile', () => {
	const result = simulateGuideProfileSync('moderator');

	assert.equal(result.nextRole, 'moderator');
	assert.equal(result.guideProfileCreated, true);
});

test('syncGuideProfile simulation upgrades members to guide', () => {
	const result = simulateGuideProfileSync('member');

	assert.equal(result.nextRole, 'guide');
	assert.equal(result.guideProfileCreated, true);
});

test('syncGuideProfile simulation assigns guide role when no current role is present', () => {
	const result = simulateGuideProfileSync(null);

	assert.equal(result.nextRole, 'guide');
	assert.equal(result.guideProfileCreated, true);
});

test('guide profile removal only demotes plain guide accounts', () => {
	assert.equal(shouldDemoteGuideProfileRemoval('guide'), true);
	assert.equal(shouldDemoteGuideProfileRemoval('moderator'), false);
	assert.equal(shouldDemoteGuideProfileRemoval('admin'), false);
	assert.equal(shouldDemoteGuideProfileRemoval('member'), false);
});
