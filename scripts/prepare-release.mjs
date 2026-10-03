import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { releaseVersion } from './release-policy.mjs';
import { pnpm, projectRoot, releaseTarball } from './release-tools.mjs';

if (process.argv.length !== 3)
  throw new Error('Usage: node scripts/prepare-release.mjs <stable version>');
const version = releaseVersion(`v${process.argv[2]}`);
const manifestPath = join(projectRoot, 'package.json');
const originalManifest = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(originalManifest);
pnpm(['run', 'build']);
// Release checkout only: no version commit or lockfile rewrite. Git tags own versions.
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
try {
  mkdirSync(join(projectRoot, '.local/release'), { recursive: true });
  pnpm(['--config.ignore-scripts=true', 'pack', '--pack-destination', '.local/release']);
  pnpm(['run', 'test:package', '--tarball', releaseTarball(version)]);
  copyFileSync(releaseTarball(version), join(projectRoot, '.local/release/package.tgz'));
  console.log(`Verified canonical release asset: tiny-asl-machine-${version}.tgz`);
} finally {
  writeFileSync(manifestPath, originalManifest);
}
