import semver from 'semver';

export function releaseVersion(tag) {
  if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error('Expected an exact stable release tag such as v2.0.0');
  }
  const version = tag.slice(1);
  if (semver.valid(version) !== version) {
    throw new Error('Expected an exact stable release tag such as v2.0.0');
  }
  return version;
}

export function publicationAction(version, latest, integrity, existingIntegrity) {
  if (existingIntegrity !== null) {
    if (existingIntegrity !== integrity) {
      throw new Error(
        `npm ${version} already contains a different tarball; versions are immutable`
      );
    }
    return 'verify';
  }
  if (!semver.gt(version, latest)) {
    throw new Error(`Refusing npm latest downgrade from ${latest} to ${version}`);
  }
  return 'publish';
}
