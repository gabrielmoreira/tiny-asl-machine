import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import semver from 'semver';
import { join } from 'node:path';
import { publicationAction, releaseVersion } from './release-policy.mjs';
import {
  capture,
  command,
  pnpm,
  projectRoot,
  registryMetadata,
  releaseTarball,
} from './release-tools.mjs';

// --check exercises the asset and registry checks, never publishes or downloads.
const checkOnly = process.argv.length === 3 && process.argv[2] === '--check';
if (process.argv.length !== 2 && !checkOnly)
  throw new Error('Usage: node scripts/publish-release.mjs [--check]');
const version = releaseVersion(process.env.RELEASE_TAG);
const tag = `v${version}`;
const tarball = releaseTarball(version);
if (!checkOnly) {
  assert.equal(
    process.env.GITHUB_REPOSITORY,
    'gabrielmoreira/tiny-asl-machine',
    'Unexpected publishing repository'
  );
  assert.equal(
    capture('git', ['rev-parse', 'HEAD']),
    capture('git', ['rev-parse', `${tag}^{commit}`]),
    'Publishing checkout must be the exact release tag'
  );
  command('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main']);
  mkdirSync(join(projectRoot, '.local/release'), { recursive: true });
  command('gh', [
    'release',
    'download',
    tag,
    '--repo',
    process.env.GITHUB_REPOSITORY,
    '--pattern',
    `tiny-asl-machine-${version}.tgz`,
    '--dir',
    '.local/release',
  ]);
}
if (!checkOnly) {
  assert.ok(semver.gte(process.versions.node, '22.14.0'), 'npm OIDC requires Node.js >=22.14.0');
  assert.ok(semver.gte(capture('npm', ['--version']), '11.5.1'), 'npm OIDC requires npm >=11.5.1');
}

const manifestPath = join(projectRoot, 'package.json');
const originalManifest = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(originalManifest);
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
try {
  pnpm(['run', 'test:package', '--tarball', tarball]);
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarball)).digest('base64');
  const existing = await registryMetadata(version);
  if (existing !== null && typeof existing.dist?.integrity !== 'string') {
    throw new Error('Existing npm version is missing immutable tarball integrity');
  }
  const latest = await registryMetadata('latest');
  assert.ok(latest?.version, 'Cannot determine npm latest version');
  const action = publicationAction(
    version,
    latest.version,
    integrity,
    existing?.dist?.integrity ?? null
  );
  if (checkOnly) {
    console.log(`Verified ${tag}; npm action would be ${action}. Nothing was published.`);
  } else {
    if (action === 'publish') {
      // OIDC is exchanged by npm. Never use a persistent npm token or lifecycle hook.
      assert.ok(
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        'npm publishing requires GitHub Actions OIDC permission'
      );
      command('npm', [
        'publish',
        tarball,
        '--access',
        'public',
        '--provenance',
        '--ignore-scripts',
        '--registry',
        'https://registry.npmjs.org/',
      ]);
    } else {
      console.log(`${tag} already exists with the same tarball; verifying the published version.`);
    }
    pnpm(['run', 'test:package', '--version', version]);
  }
} finally {
  writeFileSync(manifestPath, originalManifest);
}
