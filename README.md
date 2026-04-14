# semantic-release-keep-a-changelog

An opinionated [semantic-release](https://semantic-release.gitbook.io/) plugin that replaces both `@semantic-release/release-notes-generator` and `@semantic-release/changelog`, producing a [Keep a Changelog](https://keepachangelog.com) formatted `CHANGELOG.md` from conventional commits with zero configuration.

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

## What it does

| Lifecycle | Responsibility |
|---|---|
| `verifyConditions` | Validate optional config (`changelogFile`, `changelogTitle`) |
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

Commit types `test`, `ci`, `build`, `chore` are silently omitted, with one exception: `chore(deps)` and `chore(deps-dev)` commits (the default format used by Dependabot and similar tools) are mapped to **Changed** instead of being dropped.

## Options

| Option | Default | Description |
|---|---|---|
| `changelogFile` | `CHANGELOG.md` | Path to changelog file |
| `changelogTitle` | Keep a Changelog header | Title block prepended to the file |

All options are optional.
