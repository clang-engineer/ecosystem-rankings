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

Requires Node.js 20 or newer. Run these commands in your existing site repository.

```sh
npm install --save-dev github:clang-engineer/ecosystem-rankings
npx ecosystem-rankings init
# edit ecosystems.yml
GITHUB_TOKEN=... npx ecosystem-rankings collect
```

The init command creates the configuration and workflow without overwriting existing files. Commit the configuration, enable Actions with repository write permissions, and run the Update Ecosystem Rankings workflow. The consumer repository owns its configuration and generated data.

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


## Development

Run `npm test` to execute the test suite.

## Documentation

[Full setup and configuration guide](docs/manual.md) — ranking semantics, discovery rules, YAML examples, deployment, and limitations.

MIT License.
