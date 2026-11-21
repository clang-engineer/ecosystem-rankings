# ecosystem-rankings

Configurable rankings for developer tools and plugin ecosystems.

**Early preview:** GitHub Topic collection only; not yet published to npm.

## Try it

```sh
npm install --save-dev github:clang-engineer/ecosystem-rankings
npx ecosystem-rankings init
# edit ecosystems.json
GITHUB_TOKEN=... npx ecosystem-rankings collect
```

`init` adds `ecosystems.json` and `.github/workflows/ecosystem-rankings.yml` to an existing site without overwriting files. The workflow invokes the reusable GitHub Action and commits `data/rankings.json` and `data/history.json` when changed.

The viewer reads the generated JSON. For an existing Jekyll site, place the markup in a dedicated tab or include:

```html
<ecosystem-rankings src="/data/rankings.json"></ecosystem-rankings>
<script type="module" src="https://cdn.jsdelivr.net/gh/clang-engineer/ecosystem-rankings@main/viewer/element.js"></script>
```

For production, pin the Action and CDN URL to a release or commit SHA.

## Ranking semantics

- **All:** current cumulative GitHub Stars.
- **Week/month:** current Stars minus a snapshot from at least 7/30 days ago.
- Missing history means **collecting**, not zero growth.
- Topic search currently selects top repositories by cumulative Stars. A project outside that set cannot appear in the growth rankings.
- npm, Gradle, and Pi-specific collectors are future work.

The project is a reusable collector + Web Component, not a hosted ranking service. Each user runs the Action in their own repository and chooses their own topics.

## Installation notes

1. Install the package from GitHub (npm registry release is not available yet).
2. Run `npx ecosystem-rankings init` from the **existing site repository**; this creates the config and workflow files.
3. Edit `ecosystems.json`, commit, and push. Enable GitHub Actions and allow workflows to write repository contents.
4. Run the `Update Ecosystem Rankings` workflow once from the Actions tab. Its output appears under `data/`.
5. Embed the viewer with a `src` pointing at the generated JSON URL.

This is an early preview. GitHub Topic search can miss repositories without the tag, and week/month rankings are only for repositories included in the cumulative-Stars search window. GitHub API and live site deployment have not yet been end-to-end verified.

## Repository ownership

The package repository contains only reusable code and templates. Each consumer repository owns its own `ecosystems.json`, `.github/workflows/ecosystem-rankings.yml`, `data/rankings.json`, and `data/history.json`. For example, the author's blog runs the collector inside `clang-engineer.github.io`; no collection job is scheduled in this package repository.
