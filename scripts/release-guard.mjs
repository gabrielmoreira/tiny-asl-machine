import { appendFileSync } from 'node:fs';
import { nextReleaseTag, releaseState, releaseVersion } from './release-policy.mjs';
import { capture, registryMetadata } from './release-tools.mjs';

// Detects whether a new draft release may be prepared. A tag with no GitHub
// Release and no npm version is an orphan that semantic-release silently
// treats as the last release, so reruns never create the missing draft.
const repository = process.env.GITHUB_REPOSITORY;
if (!repository || typeof repository !== 'string' || repository.includes(' ')) {
  throw new Error('GITHUB_REPOSITORY must name the owner/repository');
}
const tags = capture('git', ['tag', '--merged', 'HEAD', '--list', 'v*.*.*'])
  .split(/\r?\n/)
  .filter(tag => tag.length > 0);
const tag = nextReleaseTag(tags);
let release = null;
let npmHasVersion = false;
if (tag) {
  const releases = JSON.parse(capture('gh', ['api', `repos/${repository}/releases?per_page=100`]));
  const found = releases.find(entry => entry.tag_name === tag);
  release = found ? { draft: found.draft } : null;
  if (!release) {
    npmHasVersion = (await registryMetadata(releaseVersion(tag))) !== null;
  }
}
const mode = releaseState({ tag, release, npmHasVersion });
const output = { mode, tag };
process.stdout.write(JSON.stringify(output) + '\n');
if (process.env.GITHUB_OUTPUT) {
  for (const [key, value] of Object.entries(output)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value ?? ''}\n`);
  }
}
