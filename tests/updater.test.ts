import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion } from '../src/version.ts';

test('isNewerVersion correctly compares semver strings', () => {
  // Newer patch
  assert.equal(isNewerVersion('0.1.0', '0.1.1'), true);
  assert.equal(isNewerVersion('v0.1.0', 'v0.1.1'), true);
  assert.equal(isNewerVersion('0.1.0', 'v0.1.1'), true);

  // Newer minor
  assert.equal(isNewerVersion('0.1.5', '0.2.0'), true);
  assert.equal(isNewerVersion('v0.1.0', '0.2.0'), true);

  // Newer major
  assert.equal(isNewerVersion('0.9.9', '1.0.0'), true);

  // Same version
  assert.equal(isNewerVersion('0.1.0', '0.1.0'), false);
  assert.equal(isNewerVersion('v0.1.0', '0.1.0'), false);
  assert.equal(isNewerVersion('0.1.0', 'v0.1.0'), false);

  // Older version
  assert.equal(isNewerVersion('0.2.0', '0.1.9'), false);
  assert.equal(isNewerVersion('1.0.0', '0.9.9'), false);
  assert.equal(isNewerVersion('0.1.2', '0.1.1'), false);
});
