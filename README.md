# semantic-release-keep-a-changelog

[![codecov](https://codecov.io/gh/shaftoe/semantic-release-keep-a-changelog/graph/badge.svg?token=kvk1MAWo7l)](https://app.codecov.io/gh/shaftoe/semantic-release-keep-a-changelog)

An opinionated [semantic-release](https://semantic-release.gitbook.io/) plugin that replaces both `@semantic-release/release-notes-generator` and `@semantic-release/changelog`, producing a [Keep a Changelog](https://keepachangelog.com) formatted `CHANGELOG.md` from conventional commits — **zero configuration, no options**.

## Install

```bash
npm install --save-dev @alexanderfortin/semantic-release-keep-a-changelog
```

## Usage

In `.releaserc.json`:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@alexanderfortin/semantic-release-keep-a-changelog"
  ]
}
```

That's it. No configuration keys, no options. The plugin will:

1. Parse your conventional commits since the last release
2. Map them to [Keep a Changelog](https://keepachangelog.com) sections
3. Generate a `CHANGELOG.md` with the standard KaC header and format

## What it does

| Lifecycle | Responsibility |
|---|---|
| `generateNotes` | Parse conventional commits → map to Keep a Changelog sections → render markdown |
| `prepare` | Merge new notes into existing `CHANGELOG.md` → write file |

## Type Mapping

Conventional commit types are mapped to Keep a Changelog sections:

| Commit Type | KaC Section |
|---|---|
| `feat` | Added |
| `fix` | Fixed |
| `perf`, `refactor`, `docs`, `style` | Changed |
| `revert` | Removed |

Breaking changes via `!` suffix (e.g. `feat!:`) and `BREAKING CHANGE:` footers are fully supported.

Commit types `test`, `ci`, `build`, `chore` are silently omitted, with one exception: `chore(deps)` and `chore(deps-dev)` commits (the default format used by Dependabot and similar tools) are mapped to **Changed** instead of being dropped.

## Limitations

- **GitHub-only** — repository URL parsing and compare links assume GitHub. GitLab, Bitbucket, and other hosting platforms are not supported.
- **Fixed output** — the changelog file is always `CHANGELOG.md` with the standard Keep a Changelog header. No customization.
