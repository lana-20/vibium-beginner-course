# Chapter 9: CI Basics — Headless, Daemon, and Environment Setup

A test suite that only runs on your laptop is not a test suite — it's a demo. The entire point of automated testing is that the machine runs the checks every time someone pushes code, so bugs get caught before they reach production. This chapter covers everything that changes when you move from local development to CI: headless mode, exit codes, the Vibium daemon lifecycle, and environment variables.

---

## headless: true in CI

CI runners don't have a display server. There's no screen, so there's no browser window to show. If you run with `headless: false`, the process fails immediately.

But you don't want to hard-code `headless: true` either — during development, you want to see the browser. The solution is an environment variable:

```typescript
const headless = process.env.CI === 'true'
const browser = await vibium.start({ headless })
```

GitHub Actions sets `CI=true` automatically for every job. Locally, `CI` is unset, so `process.env.CI === 'true'` evaluates to `false` and the browser opens visibly. One change, both environments covered.

---

## Exit codes

CI systems determine whether a job passed or failed by the process exit code. Exit code 0 means success; anything non-zero means failure. If your test fails but the process exits with 0, CI thinks everything is fine.

This is why every standalone script in this course ends with:

```typescript
main().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

When you use Vitest, this is handled automatically — a failing test causes `vitest run` to exit with code 1. You don't need to manage it manually in test files.

---

## The Vibium daemon in CI

Vibium's architecture separates the client from the browser. Your TypeScript code doesn't talk to Chrome directly — it sends messages to a daemon process, which manages the browser on its behalf.

Locally this is invisible. The first time you call `vibium.start()`, the client checks whether a daemon is running. If not, it starts one automatically. You never think about it.

CI breaks this assumption. Each workflow job starts from a clean environment — no persistent processes, no auto-start. You're responsible for the daemon lifecycle explicitly:

```yaml
- name: Start Vibium daemon
  run: vibium daemon start

- name: Run tests
  run: npm test

- name: Stop Vibium daemon
  if: always()
  run: vibium daemon stop
```

The `if: always()` on the stop step is critical. Without it, if the test step fails, the stop step is skipped — leaving a daemon running in the CI environment. `if: always()` means this step runs regardless of whether previous steps succeeded or failed. It's the YAML equivalent of `finally` in TypeScript.

---

## One browser, many tests

Starting a fresh browser for every test is the simplest approach and fine for small suites. But each browser start and stop costs a few seconds. In CI you can share one browser across all tests in a suite and only create a fresh context per test:

```typescript
describe('Products page', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let context: any
  let page: any

  beforeAll(async () => {
    browser = await vibium.start({ headless: process.env.CI === 'true' })
  })

  afterAll(async () => {
    await browser.stop()
  })

  beforeEach(async () => {
    context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await context.close()
  })

  it('shows 12 products', async () => { /* ... */ })
  it('filters by category', async () => { /* ... */ })
})
```

`beforeAll` starts one browser for the whole describe block. `beforeEach` opens a fresh context per test — fully isolated cookies, storage, and navigation history. `afterEach` closes the context so state doesn't bleed. `afterAll` stops the browser once every test is done.

---

## Environment variables

Hard-coding URLs in test code creates a problem: testing against staging or a preview deployment requires code changes. Use environment variables instead:

```typescript
const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'
```

Use `||` here, not `??`. The `??` (nullish coalescing) operator only falls back for `null` and `undefined`. GitHub Actions `vars.*` returns an empty string `""` when a variable is not configured — and `""` is falsy but not null/undefined, so `??` would use it as the URL. `||` catches any falsy value, including empty strings, so the fallback always works correctly.

For sensitive values — API keys, passwords — always use `secrets.*` rather than `vars.*` in GitHub Actions. Secrets are encrypted and masked in logs. Variables are plain text.

---

## Debugging CI failures with recordings

Tests that pass locally but fail in CI are usually timing or environment differences. This is where `vibium.record()` becomes essential:

```typescript
async function testCheckoutFlow() {
  const { browser, stop } = await vibium.record({
    headless: process.env.CI === 'true',
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // ... test logic
  } finally {
    await browser.stop()
    const url = await stop()
    console.log('Recording:', url)
  }
}
```

When the test runs in CI, the URL appears in your workflow logs. Open it at `player.vibium.dev` for an interactive replay — every action, DOM state, and network request, scrub-able frame by frame. Far more useful than reading a stack trace.

---

## Verbose CI output

Add this to your `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:ci": "vitest run --reporter=verbose"
}
```

The default Vitest reporter is compact. In CI, verbose output prints each test name, pass/fail status, and timing — faster to scan when you're looking for a specific failure. Use `npm run test:ci` in your workflow's run step.

In the next chapter we'll write the GitHub Actions workflow that ties this all together.

---

## Exercise

Update your existing test suite to work correctly in CI:

1. Replace any hardcoded `headless: false` with `const headless = process.env.CI === 'true'`
2. Replace any hardcoded `AUT` URL constant with `process.env.AUT_BASE_URL || 'https://...'`
3. Add `"test:ci": "vitest run --reporter=verbose"` to your `package.json` scripts
4. In one of your test files, switch from `vibium.start()` to `vibium.record()` using the `beforeEach`/`afterEach` pattern from Chapter 6, and log the recording URL in `afterEach`
5. Run `CI=true npm run test:ci` locally to simulate CI mode and confirm all tests pass headlessly

---

## Quiz

**1.** Why does `process.env.CI === 'true'` work as a headless flag for both local and CI environments?

- A. GitHub Actions and your shell both set `CI=true` by default
- B. GitHub Actions sets `CI=true`; locally the variable is unset, so the expression evaluates to `false`
- C. Vibium reads the `CI` variable automatically
- D. The flag only applies to headless mode, not to other settings

**2.** `if: always()` on the daemon stop step ensures:

- A. The stop command runs after every individual test
- B. The stop step runs even if earlier steps failed, preventing orphaned daemon processes
- C. GitHub Actions retries the stop step if it fails
- D. The daemon is restarted between test runs

**3.** Why use `||` instead of `??` when falling back to a default URL?

- A. `??` is not valid TypeScript
- B. GitHub Actions `vars.*` returns `""` for unset variables; `||` catches empty strings but `??` does not
- C. `||` is faster than `??` at runtime
- D. `??` only works with string types

**4.** The `beforeAll`/`afterAll` + `beforeEach`/`afterEach` pattern in Vitest achieves:

- A. One browser start per test for full isolation
- B. One browser per describe block, one fresh context per test — isolation without repeated startup cost
- C. Full test parallelism across multiple browser processes
- D. Automatic test retry on failure

**5.** `vibium.record()` is useful for CI-only failures because:

- A. It makes tests run faster in CI
- B. It produces a visual replay of every step including DOM state, letting you see exactly what the browser showed at the moment of failure
- C. It automatically retries the test on failure
- D. It disables network requests so the test is deterministic

**Answers:** 1-B, 2-B, 3-B, 4-B, 5-B

## Solution

```typescript
// src/ch09-ci/setup.ts — env-aware browser start
import { browser as vibium } from 'vibium'

export const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'

export async function startBrowser() {
  const headless = process.env.CI === 'true'
  return vibium.start({ headless })
}
```

```typescript
// src/ch09-ci/ci-smoke.test.ts — record() wired into Vitest
import { browser as vibium } from 'vibium'
import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest'
import type { Browser, Page } from 'vibium'
import { AUT } from './setup'

describe('CI smoke', () => {
  let browser: Browser
  let page: Page
  let stopRecording: (() => Promise<string>) | null = null

  beforeAll(async () => {
    const recording = await vibium.record({ headless: process.env.CI === 'true' })
    browser = recording.browser
    stopRecording = recording.stop
  })

  afterAll(async () => {
    await browser.stop()
    if (stopRecording) {
      const url = await stopRecording()
      console.log('Recording:', url)
    }
  })

  beforeEach(async () => {
    const context = await browser.newContext()
    page = await context.newPage()
  })

  it('loads the homepage', async () => {
    await page.go(AUT)
    expect(await page.title()).toBe('automation-exercise | E-commerce Testing Sandbox')
  })
})
```
