# Iron Vigil Security Scan

A GitHub Action that scans your repository, dependencies, or a container image for known CVEs and fails the build on a severity threshold you choose. Powered by [Anchore grype](https://github.com/anchore/grype).

- Scans a path, a directory, or a container image ref
- Writes a [SARIF](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) report you can upload to GitHub code scanning
- Posts a findings table to the job summary
- Gates the build on `critical` / `high` / `medium` / `low` (or never)
- Optionally ships results to your Iron Vigil workspace for trend tracking

No account required — point it at a target and go. The Iron Vigil bits are opt-in.

## Quick start

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Iron-Vigil/security-scan@v0
```

That scans the checked-out repo and fails the job if anything `high` or `critical` turns up. A findings table lands in the run's job summary.

## Recommended setup

Add SARIF upload so findings show up in the repo's **Security → Code scanning** tab and inline on PRs:

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # required to upload SARIF
    steps:
      - uses: actions/checkout@v4

      - name: Iron Vigil scan
        uses: Iron-Vigil/security-scan@v0
        with:
          target: "."
          fail-on: "high"

      - name: Upload SARIF
        if: always()            # upload even when the gate fails the build
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ironvigil-results.sarif
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `target` | `.` | What to scan — a path (`.`), a directory, or an image ref (`alpine:3.18`, `ghcr.io/you/app:sha`). |
| `fail-on` | `high` | Fail when a finding at this severity **or higher** exists: `critical`, `high`, `medium`, `low`, `negligible`, or `none` to never fail. |
| `sarif-file` | `ironvigil-results.sarif` | Where to write the SARIF report. |
| `iron-vigil-api` | `https://api.ironvigil.app` | API base for optional result submission. |
| `iron-vigil-token` | _(empty)_ | Iron Vigil CI API key. When set, results are submitted to your workspace. Pass it from a secret, never inline. |

## Outputs

| Output | Description |
|---|---|
| `sarif-file` | Path to the generated SARIF report. |
| `critical` | Number of critical findings. |
| `high` | Number of high findings. |

## How the gate works

Severities, lowest to highest:

```
negligible  <  low  <  medium  <  high  <  critical
```

`fail-on` is a floor. `fail-on: high` fails the build if there's at least one `high` **or** `critical` finding; `medium` and below pass. `fail-on: none` never fails — useful for report-only runs. Findings grype reports as `unknown` severity are counted in the summary but don't trip the gate.

## Examples

### Scan a container image

grype pulls the image from the registry — no checkout needed:

```yaml
- uses: Iron-Vigil/security-scan@v0
  with:
    target: "alpine:3.18"
    fail-on: "critical"
```

To scan an image you build earlier in the same job, load it into the local Docker daemon first and reference it by tag:

```yaml
- uses: docker/build-push-action@v6
  with:
    load: true
    tags: app:${{ github.sha }}
- uses: Iron-Vigil/security-scan@v0
  with:
    target: "app:${{ github.sha }}"
```

### Strict gate on pull requests, looser on pushes

```yaml
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Iron-Vigil/security-scan@v0
        with:
          # block PRs on anything high+, but only critical on the default branch
          fail-on: ${{ github.event_name == 'pull_request' && 'high' || 'critical' }}
```

### Report-only (never fail the build)

Surface findings without blocking — pair with SARIF upload so they still show up in code scanning:

```yaml
- uses: Iron-Vigil/security-scan@v0
  with:
    fail-on: "none"
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ironvigil-results.sarif
```

### Scheduled scan

Catch CVEs disclosed after you last shipped — the code didn't change, but the vulnerability database did:

```yaml
on:
  schedule:
    - cron: "0 7 * * 1"   # every Monday 07:00 UTC
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Iron-Vigil/security-scan@v0
        with:
          fail-on: "high"
```

### Send results to your Iron Vigil workspace

With a CI API key set, each run is submitted to Iron Vigil so you get history, trends, and per-framework compliance mapping across runs:

```yaml
- uses: Iron-Vigil/security-scan@v0
  with:
    iron-vigil-token: ${{ secrets.IRON_VIGIL_TOKEN }}
```

Submission is best-effort — if the API isn't reachable the scan and gate still run normally.

### Use the outputs

```yaml
- id: scan
  uses: Iron-Vigil/security-scan@v0
  with:
    fail-on: "none"           # don't fail; decide for yourself below
- name: Block on criticals
  if: steps.scan.outputs.critical != '0'
  run: |
    echo "::error::${{ steps.scan.outputs.critical }} critical CVE(s) found"
    exit 1
```

### Matrix over several images

```yaml
jobs:
  scan:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        image: ["api:latest", "worker:latest", "nginx:1.27-alpine"]
    steps:
      - uses: Iron-Vigil/security-scan@v0
        with:
          target: ${{ matrix.image }}
          fail-on: "high"
```

## GitHub code scanning (SARIF)

The action always writes a SARIF file (`ironvigil-results.sarif` by default). Upload it with `github/codeql-action/upload-sarif@v3` to get findings in the **Security → Code scanning** tab and annotated on PR diffs.

Two things to get right:

- `permissions: security-events: write` on the job, or the upload is rejected.
- `if: always()` on the upload step — otherwise a failed gate skips the upload and you lose the report for that run.

## Requirements

- A **Linux** runner (`ubuntu-latest` works out of the box). The action is a composite that runs `bash` and `node`, both present on GitHub-hosted runners.
- `contents: read` to check out the repo; `security-events: write` only if you upload SARIF.
- Container-image scanning uses the runner's Docker daemon (already available on `ubuntu-latest`).

## Versioning

```yaml
uses: Iron-Vigil/security-scan@v0      # moving tag — latest v0.x
uses: Iron-Vigil/security-scan@v0.1.0  # exact release
uses: Iron-Vigil/security-scan@<sha>   # pin a commit (strictest supply-chain)
```

`@v0` tracks the latest backward-compatible release. Pin to a tag or commit SHA if you want fully reproducible runs.

## How it works

1. Installs grype to a temp dir using the official Anchore install script.
2. Runs grype against `target`, emitting both SARIF (for code scanning) and JSON (for the summary and optional submission).
3. If `iron-vigil-token` is set, POSTs the JSON to `iron-vigil-api`.
4. Parses the JSON into a job-summary table, sets the `critical` / `high` outputs, and exits non-zero if the `fail-on` threshold is breached.

It's a thin composite action — read [`scan.sh`](scan.sh) and [`summarize.js`](summarize.js); there's not much to it.

## License

MIT.
