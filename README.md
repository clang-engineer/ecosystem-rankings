# ecosystem-rankings

**Build and publish your own developer-tool rankings.**

[Explore the live Radar demo](https://clang-engineer.github.io/radar/)

Discover GitHub repositories, track Stars over time, and embed rankings on your own website.

## Highlights

- Configurable categories using topics, search queries, and curated lists.
- Historical snapshots for cumulative Stars and growth rankings.
- GitHub Actions collection in your own repository.
- Embeddable Web Component; no dedicated ranking server required.

## Quick start

```sh
npm install --save-dev github:clang-engineer/ecosystem-rankings
npx ecosystem-rankings init
# edit ecosystems.yml
GITHUB_TOKEN=... npx ecosystem-rankings collect
```

Embed the generated rankings:

```html
<ecosystem-rankings src="/data/rankings.json"></ecosystem-rankings>
<script type="module" src="https://cdn.jsdelivr.net/gh/clang-engineer/ecosystem-rankings@main/viewer/element.js"></script>
```

Pin the Action and viewer URL to a release or commit for production.

## How it works

```text
ecosystems.yml → Collector → Rankings + History JSON → Web Component
                     ↑
               GitHub Actions
```

**Early preview:** install from GitHub, not npm. Rankings depend on discovery coverage and available history; missing history does not mean zero growth.

## Documentation

[Full setup and configuration guide](docs/manual.md) — ranking semantics, discovery rules, YAML examples, deployment, and limitations.
