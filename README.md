# ecosystem-rankings

Configurable rankings for developer tools and plugin ecosystems.

**Early preview:** GitHub Topic collection only; not yet published to npm.

## Try it

```sh
node bin/cli.js init
# edit ecosystems.json
GITHUB_TOKEN=... node bin/cli.js collect
```

`init` adds `ecosystems.json` and `.github/workflows/ecosystem-rankings.yml` to an existing site without overwriting files. The workflow invokes this repository's reusable GitHub Action and commits `data/rankings.json` and `data/history.json` when changed.

The viewer reads the generated JSON:

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
