# Chapter 10: Introduction to MCP

Every chapter until now has used Vibium's TypeScript client: you write the steps, you define the assertions, you control every action. This chapter introduces a different mode — Model Context Protocol (MCP) — where an AI agent drives the browser on your behalf.

---

## 10.1 Three Ways to Use Vibium

Vibium ships with three interfaces, all talking to the same daemon:

| Interface | Who drives it | Best for |
|-----------|--------------|----------|
| CLI (`vibium find text "..."`) | You, at a terminal | Exploration, one-off checks |
| TypeScript/Python/Java client | You, in code | Deterministic test suites |
| MCP server | An AI agent | Open-ended exploration, test generation |

The TypeScript client you've used throughout this course is the right tool for regression tests: predictable, fast, composable. MCP is the right tool when you want to describe a scenario in natural language and let the agent figure out the steps.

---

## 10.2 What MCP Is

The Model Context Protocol is an open standard that defines how AI models connect to tools. When Vibium runs as an MCP server, it exposes its browser automation tools — navigate, find, click, fill, screenshot — as MCP tool calls. An AI model (such as Claude) can invoke those tools to explore and interact with a live browser.

From your perspective: you describe what you want to test, and the agent navigates, reads the page, takes actions, and reports back what it found.

---

## 10.3 Starting Vibium in MCP Mode

Vibium's MCP server is configured in your AI client's settings. In Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vibium": {
      "command": "vibium",
      "args": ["mcp"]
    }
  }
}
```

Once configured and the Claude Desktop app is restarted, you can type natural language commands and Claude will use Vibium's MCP tools to carry them out in a real browser.

---

## 10.4 A Side-by-Side Comparison

The same scenario expressed two ways:

**TypeScript client (deterministic):**

```typescript
await page.go('https://automation-exercise.daisyladybug.com/products')
const select = await page.find({ css: 'select:first-of-type' })
await select.select('Electronics')
await page.waitForText('SHOWING 3 OF 12 PRODUCTS')
const count = await page.count('a[href*="/products/prod_"]')
assert.equal(count, 3)
```

**MCP prompt (agent-driven):**

```
Go to automation-exercise.daisyladybug.com/products.
Filter by the Electronics category.
Tell me how many products are shown and what their names are.
```

The TypeScript version is precise, repeatable, and fast. The MCP version is flexible — you don't need to know the selector, the exact text, or even that there's a `select` element. The agent figures it out.

---

## 10.5 When to Use Each

Use the TypeScript client when:
- You're writing a regression test that must pass/fail deterministically
- You know exactly what to check and how to check it
- You need it to run unattended in CI
- You care about cost (TypeScript client uses the Vibium daemon directly; MCP routes through an LLM)

Use MCP when:
- You're exploring a new page for the first time
- You want to generate test cases by describing scenarios
- You're debugging a flaky test and want a second opinion on what the page looks like
- You're prototyping an automation before writing the formal test

---

## 10.6 Generating TypeScript Tests with MCP

One powerful workflow: use MCP to explore and describe a flow, then ask the agent to generate the corresponding TypeScript. The agent can observe the page, identify selectors, and produce a test file you refine and commit.

Example prompt:

```
Navigate to automation-exercise.daisyladybug.com/products.
Find the search input and search for "coffee".
Tell me what appears and generate a Vibium TypeScript test
that asserts the correct product is visible and others are not.
```

The agent navigates, observes, and returns TypeScript code using `page.find()`, `page.waitForText()`, and assertions. You review the output, clean it up, and add it to your test suite.

This is how MCP fits into a test automation workflow: agents for exploration and generation, TypeScript client for the final executable tests.

---

## 10.7 Course Summary

You've covered the full arc from installing Vibium to running tests in CI:

1. **The Landscape** — where Vibium fits among Selenium, Playwright, and Cypress
2. **Architecture** — Browser → BrowserContext → Page → Element, and the three action categories
3. **Your First Test** — navigate, find, assert, cleanup
4. **Working with Forms** — fill, select, validation, the complete checkout flow
5. **Assertions and Waiting** — element state methods, waitForText, waitForURL, asserting totals
6. **Organizing Tests** — Vitest, beforeEach/afterEach, Page Objects
7. **Capturing Events** — dialogs, console, downloads with `Promise.all`
8. **Network Interception** — stubbing APIs, simulating failures
9. **Running in CI** — headless mode, exit codes, GitHub Actions
10. **Introduction to MCP** — agent-driven automation, when to use each interface

The patterns from this course — async/await, `try/finally`, `waitFor*` before assertions, Page Objects, `Promise.all` for captures — compose directly into production test suites. Keep them in mind as you extend your test coverage.
