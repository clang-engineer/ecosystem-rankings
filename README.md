# ecosystem-rankings

Configurable rankings for developer tools and plugin ecosystems.

**Early preview:** GitHub Topic and repository keyword discovery; not yet published to npm.

## Try it

```sh
npm install --save-dev github:clang-engineer/ecosystem-rankings
npx ecosystem-rankings init
# edit ecosystems.yml
GITHUB_TOKEN=... npx ecosystem-rankings collect
```

`init` adds `ecosystems.yml` and `.github/workflows/ecosystem-rankings.yml` to an existing site without overwriting files. The workflow invokes the reusable GitHub Action and commits `data/rankings.json` and `data/history.json` when changed.

The viewer reads the generated JSON. For an existing Jekyll site, place the markup in a dedicated tab or include:

```html
<ecosystem-rankings src="/data/rankings.json"></ecosystem-rankings>
<script type="module" src="https://cdn.jsdelivr.net/gh/clang-engineer/ecosystem-rankings@main/viewer/element.js"></script>
```

Set the initial Viewer period in `ecosystems.yml`: `viewer.default_period: 7`. The collector includes this setting in the generated JSON; the Viewer reads it automatically. `0` means cumulative all-time Stars. Users can change periods in the Viewer. Period rankings appear only after sufficient history has accumulated.\n\nFor production, pin the Action and CDN URL to a release or commit SHA.

## Ranking semantics

- **All:** current cumulative GitHub Stars.
- **Numeric periods:** current Stars minus the most recent snapshot at or before the requested number of days ago.
- Missing history means **collecting**, not zero growth. Defaults: `periods: [7, 30, 0]`, `viewer.default_period: 0`.
- Topic and keyword searches discover candidates. Previously discovered repositories from the last generated rankings JSON are refreshed and retained even when they drop out of search results. A repository that has never been discovered cannot appear in growth rankings.
- npm, Gradle, and Pi-specific collectors are future work.

The project is a reusable collector + Web Component, not a hosted ranking service. Each user runs the Action in their own repository and chooses their own topics.

## Installation notes

1. Install the package from GitHub (npm registry release is not available yet).
2. Run `npx ecosystem-rankings init` from the **existing site repository**; this creates the config and workflow files.
3. Edit `ecosystems.yml`, commit, and push. Enable GitHub Actions and allow workflows to write repository contents.
4. Run the `Update Ecosystem Rankings` workflow once from the Actions tab. Its output appears under `data/`.
5. Embed the viewer with a `src` pointing at the generated JSON URL.

This is an early preview. GitHub Topic search can miss repositories without the tag, and week/month rankings are only for repositories included in the cumulative-Stars search window. GitHub API and live site deployment have not yet been end-to-end verified.

## Repository ownership

The package repository contains only reusable code and templates. Each consumer repository owns its own `ecosystems.yml`, `.github/workflows/ecosystem-rankings.yml`, `data/rankings.json`, and `data/history.json`. For example, the author's blog runs the collector inside `clang-engineer.github.io`; no collection job is scheduled in this package repository.

## Topic discovery + explicit repositories

A category may combine GitHub Topic discovery with known repositories that do not use the expected topic:

```json
{
  "ecosystems": [
    {
      "id": "terminal-file-managers",
      "name": "Terminal File Managers",
      "source": "github",
      "topic": "terminal-file-manager",
      "limit": 30,
      "repositories": ["sxyazi/yazi", "ranger/ranger", "gokcehan/lf"]
    }
  ]
}
```

Explicit repositories are fetched individually, merged case-insensitively with topic results, deduplicated, and sorted by cumulative Stars. You can omit `topic` and specify only `repositories`. Each additional repository consumes a GitHub API request.

## YAML configuration

```yaml
viewer:
  default_period: 7
periods: [7, 30, 0] # 0 = all-time; positive numbers = days
ecosystems:
  - id: terminal-file-managers
    name: Terminal File Managers
    source: github
    topic: terminal-file-manager
    limit: 30
    repositories:
      - sxyazi/yazi
      - ranger/ranger
```

The collector writes `periods` and `defaultPeriod` into `rankings.json`; the Viewer requires no separate period attribute. Custom periods require historical snapshots of at least that age. History retention scales to the longest configured period (plus five days). JSON input remains supported via `--config` for backward compatibility.

## Discovery modes and exclusions

Set `discovery: curated` to rank **only** the explicitly listed `repositories` (recommended for narrowly defined categories). Use `discovery: topic` to merge GitHub Topic search results with the explicit list. The default is `topic` when a topic is provided, otherwise `curated`.

```yaml
  - id: tmux-plugins
    name: tmux Plugins
    source: github
    discovery: curated
    repositories:
      - tmux-plugins/tpm
      - tmux-plugins/tmux-yank
    exclude:
      - some-owner/unrelated-repository
```

`exclude` removes repositories case-insensitively, including explicitly listed repositories. Curated rankings prioritize category precision over exhaustive discovery; maintainers should review and expand their lists periodically.

## Automatic discovery with multiple queries

`discovery: topic` combines a GitHub Topic search with up to five additional GitHub repository search queries. `repositories` remains an optional inclusion list for major projects missing from searches, and `exclude` removes known mismatches. Results are deduplicated case-insensitively and sorted by Stars.

```yaml
- id: tmux-plugins
  name: tmux Plugins
  source: github
  discovery: topic
  topic: tmux-plugin
  searches:
    - "tmux plugin in:name,description"
  limit: 100
  repositories:
    - tmux-plugins/tpm
  exclude:
    - some-owner/unrelated-project
```

Search results are candidates rather than guaranteed category members. GitHub repository search may include adjacent tools; use targeted queries and `exclude` to improve precision. Each query uses a GitHub Search API request and is subject to rate limits.

## Historical Stars pilot (not enabled in production)

`src/stargazers-pilot.js` exposes `estimateRecentStars` to inspect a limited number of GitHub Stargazers API pages (dated `starred_at` responses). It returns `retainedStarsAdded` only when the requested period is fully covered within the page budget; otherwise it returns `null` and `complete: false`. This is **not** the net change in Stars: unstar events are not recoverable. It does not alter `history.json`, `rankings.json`, or the Viewer, and should not be mixed into snapshot-based growth rankings without an explicit metric label and validation.
