# Course Conclusion: What's Next

You've finished the course. Here's what you built, what to do next, and how to keep improving.

---

## What you built

Over 12 chapters you wrote a complete browser automation test suite:

- A **homepage smoke test** with five assertions covering title, headings, product data, and navigation
- A **forms test** using `fill()`, `selectOption()`, the `fieldMap` loop pattern, and `_waitForURL` for checkout
- A **dynamic state test** that waits on DOM updates before asserting cart totals
- A **Vitest suite** with Page Objects, `beforeEach`/`afterEach` lifecycle, and the `vibium.record()` integration
- **Capture tests** for dialogs, console output, and file downloads — all using the `Promise.all` fire-and-forget pattern
- **Network intercept tests** that stub responses, simulate 500 errors, and use partial intercepts for edge cases
- A **GitHub Actions workflow** using a pre-baked Docker image, daemon lifecycle management, and verbose CI logging
- An introduction to the **MCP interface** for agent-driven browser automation

All of it runs against a real application. Every pattern you used here transfers directly to production test suites.

---

## Patterns to take with you

Five patterns from this course appear in almost every professional-grade test suite. Internalize these and the rest follows:

**Wait for the observable outcome, then assert.** Never assert immediately after an action that causes a DOM change. Insert `page.find({ text })` or `page._waitForURL()` first. This eliminates the most common source of test flakiness.

**Try/finally for cleanup.** `browser.stop()` belongs in `finally`, always. In Vitest, `afterEach` serves the same role. Tests that don't clean up leave state that breaks other tests in ways that are very hard to diagnose.

**Page Objects for selectors.** Selectors change. Tests shouldn't. Centralizing selectors in a Page Object class means a CSS class rename requires one edit, not a grep-and-replace across 40 test files.

**Promise.all for captures.** Register the capture before the action that fires it. The fire-and-forget click inside `Promise.all` is the only reliable way to handle dialogs, console, and downloads. Any other pattern creates a deadlock.

**Recordings for CI failures.** When a test passes locally and fails in CI, you cannot diagnose it from a stack trace alone. A recording gives you the DOM state at every step. This is the difference between a 10-minute fix and a two-hour debugging session.

---

## What to do next

**Practice on a real application.** Find an app you use and write 5 tests for it — a smoke test, a form submission, a search, a negative case, and one that involves dynamic DOM updates. The patterns from this course will feel different against an app you didn't build and don't fully understand.

**Read the Vibium documentation.** This course covers the most common patterns but not the full API. The docs have reference pages for every method with examples. Spend an hour with the sections on network interception, context options, and the CLI.

**Learn Playwright.** Vibium and Playwright share architectural concepts — contexts, pages, auto-waiting, network interception. If you understand Vibium, picking up Playwright is straightforward. Many teams use both: Vibium for agent-driven workflows, Playwright for the main test suite.

**Explore the MCP interface.** Chapter 12 scratched the surface. The real power of Vibium's MCP interface is in building agent workflows that use test results as feedback — an agent that runs a test, reads the failure, adjusts the application, and re-tests. That's where the industry is heading.

---

## A note on the tools

Vibium is a young project. APIs will evolve, new features will appear, and patterns that are idiomatic today may be superseded by better ones. The fundamentals — wait for observable state, keep tests atomic, separate data from logic — are stable across all tools and versions. Those are worth more than any specific API.

If something in this course no longer works as described, check the Vibium changelog. If you find a discrepancy, the course repository has an issues page.

Good luck, and thank you for taking this course.
