# Vibium Beginner Course

Code examples and course materials for **Vibium: Browser Automation with TypeScript** (Udemy).

**AUT:** [automation-exercise.daisyladybug.com](https://automation-exercise.daisyladybug.com)

---

## Prerequisites

- Node.js 20+
- `npm install`
- Vibium daemon running: `vibium start` (or set `CI=true` for headless)

## Quick Start

```bash
npm install
npm test          # full vitest suite
npm run ch03:complete   # run a single chapter example
```

---

## Course Chapters

| # | Chapter | HTML |
|---|---------|------|
| Intro | Course Introduction | [00-intro](chapters/00-intro.html) |
| 1 | The Automation Landscape | [01-landscape](chapters/01-landscape.html) |
| 2 | Vibium Architecture | [02-architecture](chapters/02-architecture.html) |
| 3 | Your First Test | [03-first-test](chapters/03-first-test.html) |
| 4 | Forms & User Input | [04-forms](chapters/04-forms.html) |
| 5 | Assertions & Waiting | [05-assertions-waiting](chapters/05-assertions-waiting.html) |
| 6 | Organizing Tests | [06-organizing-tests](chapters/06-organizing-tests.html) |
| 7 | Captures | [07-captures](chapters/07-captures.html) |
| 8 | Network Interception | [08-network](chapters/08-network.html) |
| 9 | CI Basics | [09-ci-local](chapters/09-ci-local.html) |
| 10 ★ | GitHub Actions *(bonus)* | [10-ci-actions](chapters/10-ci-actions.html) |
| 11 ★ | Docker CI *(bonus)* | [11-ci-docker](chapters/11-ci-docker.html) |
| 12 ★ | MCP Interface *(bonus)* | [12-mcp](chapters/12-mcp.html) |
| 13 | Conclusion | [13-conclusion](chapters/13-conclusion.html) |

**Reference:** [Cheat Sheet](reference/cheat-sheet.html)

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run full Vitest suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:ci` | Verbose reporter (CI output) |
| `npm run ch02:hierarchy` | Browser / context / page hierarchy demo |
| `npm run ch02:interactions` | Actions, captures, waits overview |
| `npm run ch03:read` | Navigate and read page content |
| `npm run ch03:assert` | First assertion |
| `npm run ch03:complete` | Complete test with teardown |
| `npm run ch04:search` | Search and filter form |
| `npm run ch04:validation` | Validation error handling |
| `npm run ch04:checkout` | Full checkout flow |
| `npm run ch05:state` | Element state checks |
| `npm run ch05:waits` | Explicit waiting patterns |
| `npm run ch05:totals` | Cart total assertions |
| `npm run ch06:suite` | Run organized test suite (Vitest) |
| `npm run ch07:dialog` | Dialog capture |
| `npm run ch07:console` | Console capture |
| `npm run ch07:download` | File download capture |
| `npm run ch08:stub` | Stub network response |
| `npm run ch08:abort` | Abort network request |
| `npm run ch08:partial` | Partial network interception |
| `npm run ch09:smoke` | CI smoke test |
| `npm run ch12:compare` | TypeScript vs MCP side-by-side |

---

## Repo Structure

```
chapters/         course pages (HTML + Markdown source)
exercises/        starter files for chapter exercises
reference/        cheat-sheet.html and cheat-sheet.md
src/
  ch02-architecture/
  ch03-first-test/
  ch04-forms/
  ch05-assertions/
  ch06-organizing/
  ch07-captures/
  ch08-network/
  ch09-ci/
  ch10-mcp/
Dockerfile        development container
Dockerfile.ci     pre-baked CI image (ghcr.io/lana-20/vibium-ci:latest)
vitest.config.ts
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUT_BASE_URL` | `https://automation-exercise.daisyladybug.com` | Target app URL |
| `CI` | — | Set to `true` for headless mode |
| `TEST_TIMEOUT` | `60000` | Vitest test timeout (ms) |

## CI

Tests run in the pre-baked Docker image `ghcr.io/lana-20/vibium-ci:latest` via GitHub Actions (`.github/workflows/tests.yml`). The image includes Vibium and all Node dependencies. See the bonus chapters (10–11) for workflow details.
