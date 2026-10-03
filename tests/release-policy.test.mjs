import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import releaseConfig from '../release.config.mjs';
import {
  nextReleaseTag,
  publicationAction,
  releaseState,
  releaseVersion,
} from '../scripts/release-policy.mjs';

test('only exact stable v-prefixed release tags can publish', () => {
  assert.equal(releaseVersion('v2.0.0'), '2.0.0');
  for (const tag of ['2.0.0', 'v02.0.0', 'v2.0.0-beta.1', 'v2.0.0+build', 'v2.0.0\n', '--help']) {
    assert.throws(() => releaseVersion(tag), /stable release tag/);
  }
});

test('new release must be newer than the npm latest version', () => {
  assert.equal(publicationAction('2.0.0', '1.0.0', 'sha512-new', null), 'publish');
  assert.throws(() => publicationAction('1.5.0', '2.0.0', 'sha512-old', null), /downgrade/);
  assert.throws(() => publicationAction('2.0.0', '2.0.0', 'sha512-new', null), /downgrade/);
});

test('reruns may verify an existing immutable version but never replace it', () => {
  assert.equal(publicationAction('2.0.0', '2.1.0', 'sha512-match', 'sha512-match'), 'verify');
  assert.throws(
    () => publicationAction('2.0.0', '2.1.0', 'sha512-new', 'sha512-other'),
    /different tarball/
  );
});

test('the next release tag is the newest stable tag', () => {
  assert.equal(nextReleaseTag(['v1.0.0', 'v0.9.0', 'v2.0.0']), 'v2.0.0');
  assert.equal(nextReleaseTag(['v2.0.0-beta.1', 'v1.0.0', 'not-a-tag']), 'v1.0.0');
  assert.equal(nextReleaseTag([]), null);
});

test('an orphaned tag is detected instead of silently skipping the release', () => {
  assert.equal(releaseState({ tag: null, release: null, npmHasVersion: false }), 'proceed');
  assert.equal(
    releaseState({ tag: 'v2.0.0', release: { draft: false }, npmHasVersion: false }),
    'proceed'
  );
  assert.equal(releaseState({ tag: 'v1.0.0', release: null, npmHasVersion: true }), 'proceed');
  assert.equal(
    releaseState({ tag: 'v2.0.0', release: { draft: true }, npmHasVersion: false }),
    'pending'
  );
  assert.equal(releaseState({ tag: 'v2.0.0', release: null, npmHasVersion: false }), 'orphan');
});

test('breaking headers trigger a major release even without a footer', async () => {
  const require = createRequire(import.meta.url);
  const releaseRequire = createRequire(require.resolve('semantic-release'));
  const { analyzeCommits } = await import(
    pathToFileURL(releaseRequire.resolve('@semantic-release/commit-analyzer')).href
  );
  const [, options] = releaseConfig.plugins.find(
    ([name]) => name === '@semantic-release/commit-analyzer'
  );
  const logger = { log() {} };
  assert.equal(
    await analyzeCommits(options, {
      cwd: process.cwd(),
      logger,
      commits: [{ message: 'chore!: require Node.js 22' }],
    }),
    'major'
  );
  assert.equal(
    await analyzeCommits(options, {
      cwd: process.cwd(),
      logger,
      commits: [{ message: 'fix: preserve error causes' }],
    }),
    'patch'
  );
  assert.equal(
    await analyzeCommits(options, {
      cwd: process.cwd(),
      logger,
      commits: [{ message: 'docs: clarify installation' }],
    }),
    null
  );
});

test('release notes retain breaking guidance and the comparison range', async () => {
  const require = createRequire(import.meta.url);
  const releaseRequire = createRequire(require.resolve('semantic-release'));
  const { generateNotes } = await import(
    pathToFileURL(releaseRequire.resolve('@semantic-release/release-notes-generator')).href
  );
  const [, options] = releaseConfig.plugins.find(
    ([name]) => name === '@semantic-release/release-notes-generator'
  );
  const notes = await generateNotes(options, {
    cwd: process.cwd(),
    logger: { log() {} },
    options: { repositoryUrl: 'https://github.com/gabrielmoreira/tiny-asl-machine.git' },
    branch: { name: 'main' },
    lastRelease: { gitTag: 'v1.0.0' },
    nextRelease: { gitTag: 'v2.0.0', version: '2.0.0' },
    commits: [
      {
        hash: '0123456789abcdef0123456789abcdef01234567',
        message: 'feat!: require Node.js 22\n\nBREAKING CHANGE: Node.js 20 is no longer supported.',
      },
    ],
  });
  assert.match(notes, /BREAKING CHANGES/);
  assert.match(notes, /Node\.js 20 is no longer supported/);
  assert.match(notes, /v1\.0\.0\.\.\.v2\.0\.0/);
});
