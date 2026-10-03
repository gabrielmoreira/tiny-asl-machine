import assert from 'node:assert/strict';
import { capture, command, registryMetadata } from './release-tools.mjs';

// All 13 published JS files match this source compiled with TypeScript 6.0.3;
// root types, skills, LICENSE and README also match the npm 1.0.0 tarball.
const baselineCommit = 'd8c416bdabc8eff587d2d260fe053b011eb97de7';
const baselineTag = 'v1.0.0';
const baselineIntegrity =
  'sha512-t30AwOGu7i0BBd7ZIqZ3WA1BsTYJGdRijyA699Ek2Bv4inaBMa+TGiSrO1dmaOrVhQjluR2eXXpcvWiTgjQSYA==';

command('git', ['merge-base', '--is-ancestor', baselineCommit, 'HEAD']);
const existing = capture('git', ['tag', '--list', baselineTag]);
if (existing) {
  assert.equal(
    capture('git', ['rev-parse', `${baselineTag}^{commit}`]),
    baselineCommit,
    'The existing v1.0.0 tag does not match the verified npm baseline'
  );
  console.log('The verified v1.0.0 release baseline is already present.');
} else {
  const published = await registryMetadata('1.0.0');
  assert.equal(
    published?.dist?.integrity,
    baselineIntegrity,
    'npm 1.0.0 baseline integrity changed'
  );
  command('git', ['tag', baselineTag, baselineCommit]);
  console.log(
    'Prepared the verified local v1.0.0 baseline; semantic-release pushes tags only during a real release.'
  );
}
