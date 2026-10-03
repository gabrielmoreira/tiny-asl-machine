export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/prepare-release.mjs ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/github',
      {
        draftRelease: true,
        assets: [
          {
            path: '.local/release/package.tgz',
            name: 'tiny-asl-machine-${nextRelease.version}.tgz',
            label: 'Verified npm package',
          },
        ],
        successComment: false,
        failComment: false,
        failTitle: false,
        releasedLabels: false,
      },
    ],
  ],
};
