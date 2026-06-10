# Chapter 10: Introduction to MCP

Every chapter until now has been about writing code that drives the browser. You write the steps. You define the selectors. You control every action. In this final chapter we look at something fundamentally different: the Model Context Protocol, where you describe what you want in natural language and an AI agent figures out the steps.

This isn't replacing what you've learned — it's extending it. The TypeScript client and MCP are two tools in the same toolkit, and understanding when to reach for each one is the skill we're building here.

---

## Three interfaces, one daemon

Let me refresh the picture from Chapter 2. Vibium exposes its browser engine through three distinct interfaces, all talking to the same daemon:

| Interface | Who drives it | Best for |
|-----------|--------------|----------|
| CLI | You, in a terminal | Exploration and quick one-off checks |
| TypeScript / Python / Java client | You, in code | Deterministic test suites that run in CI |
| MCP server | An AI agent | Open-ended exploration, test generation, debugging |

You've been using the TypeScript client throughout this course. The CLI we've touched briefly for exploration. The MCP server is what we're looking at now.

The important thing to understand is that these aren't different products — they're different entry points into the same engine. A `page.find()` call from TypeScript, a `vibium find text "..."` from the CLI, and a `browser_find` MCP tool call from Claude all end up at the same place: the Vibium daemon, which talks to the browser.

---

## What MCP is

The Model Context Protocol is an open standard — similar in purpose to what USB is for hardware. AI models speak MCP to connect to external tools. When Vibium runs as an MCP server, it exposes its browser automation capabilities — navigate, find, click, fill, screenshot, and more — as MCP tool calls. Any AI model that speaks MCP can invoke those tools.

From your perspective as a test engineer, this means you can open Claude Desktop, describe what you want to test, and watch Claude navigate a real browser, read the page, take actions, and report back. The AI handles selector discovery, action sequencing, and error recovery. You describe the outcome you want.

---

## Setting it up

Configure the Vibium MCP server in Claude Desktop. Open `~/Library/Application Support/Claude/claude_desktop_config.json` and add:

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

Restart Claude Desktop. You'll see the Vibium tools become available — look for the hammer icon in the interface, which indicates active MCP connections. From here, you can interact with a live browser through natural language.

---

## TypeScript client vs MCP: a side-by-side

The same scenario expressed two ways:

**TypeScript client — precise and deterministic:**

```typescript
await page.go('https://automation-exercise.daisyladybug.com/products')
const select = await page.find({ css: 'select:first-of-type' })
await select.select('Electronics')
await page.waitForText('SHOWING 3 OF 12 PRODUCTS')
const count = await page.count('a[href*="/products/prod_"]')
assert.equal(count, 3, '3 Electronics products')
```

**MCP prompt — flexible and exploratory:**

```
Go to automation-exercise.daisyladybug.com/products.
Filter by the Electronics category.
Tell me how many products are shown and what their names are.
```

The TypeScript version knows the selector (`select:first-of-type`), knows the expected count (`3`), and will fail with a clear message if either changes. The MCP version doesn't need to know any of that. Claude finds the dropdown, identifies the correct option, applies the filter, reads the results, and tells you what it found.

Neither is better — they're different tools for different moments.

---

## When to use each

Use the **TypeScript client** when:

- You're writing a regression test that must pass/fail deterministically
- You know exactly what to check and how to check it
- The test needs to run unattended in CI on every push
- Cost matters — TypeScript client uses the daemon directly, no LLM inference

Use **MCP** when:

- You're exploring a new page or flow for the first time and don't yet know the selectors
- You want to describe a test scenario and let the agent generate initial TypeScript code
- You're debugging a flaky test and want to see what the page actually looks like at the failure point
- You're doing broad exploratory testing where the exact assertions aren't defined yet

---

## The generation workflow

One of the most valuable MCP workflows is test generation: use MCP to explore and document a flow, then ask the agent to produce the TypeScript.

Here's an example prompt you might give Claude:

```
Navigate to automation-exercise.daisyladybug.com/products.
Find the search input and search for "coffee".
Tell me what products appear and generate a Vibium TypeScript test
that asserts the correct product is visible and that "Wireless Headphones"
is not visible after the search.
```

Claude navigates the app, performs the search, reads the results, and generates a test like:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testSearchForCoffee() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)

    const search = await page.find({ css: "input[placeholder='Search products...']" })
    await search.fill('coffee')

    const coffeeMaker = await page.find({ text: 'Coffee Maker' })
    assert.ok(await coffeeMaker.isVisible(), 'Coffee Maker visible after search')

    const headphones = await page.find({ text: 'Wireless Headphones' })
    assert.ok(!await headphones.isVisible(), 'Wireless Headphones hidden after search')

    console.log('Search assertions passed.')
  } finally {
    await browser.close()
  }
}

testSearchForCoffee().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

You review it, refine it, add it to your test suite. The agent did the exploration; you own the final code.

This workflow becomes especially powerful for large applications with many pages — MCP handles the discovery phase, you handle the quality gate.

---

## Course summary

You've covered the complete arc of browser test automation with Vibium. Let me walk back through what we built:

In **Chapter 1** we mapped the ecosystem — where Selenium and WebDriver BiDi came from, what Playwright and Cypress bring to the table, and why Vibium sits at a new point in the landscape where the lines between "test runner" and "AI agent" are blurring.

In **Chapter 2** we opened up the engine — the Browser/Context/Page/Element hierarchy that everything in this course builds on, the three categories of operations (actions, captures, waits), and the OOP model that makes the Page Object Pattern natural.

In **Chapter 3** you wrote your first real test — navigate, find, assert, clean up with `try/finally`. We also looked at `vibium.record()` and how recordings at `player.vibium.dev` give you a time machine for debugging.

In **Chapter 4** you drove forms — `fill()`, `select()`, the `fieldMap` loop pattern for multi-field forms, and the checkout flow from cart to confirmation.

In **Chapter 5** you learned assertions and waiting — `isVisible()`, `isEnabled()`, `isChecked()`, `text()`, `value()`, `attr()`, and the rule: always `waitForText` or `waitForURL` after an action that causes a DOM update, before asserting on the result.

In **Chapter 6** you built a real test framework — Vitest, `beforeEach`/`afterEach` for atomic tests, Page Objects for DRY selectors, and the OOP and Single Responsibility principles that make a test codebase maintainable.

In **Chapter 7** you worked with captures — the `Promise.all` pattern for dialogs, console, and downloads, and why the click inside a capture must fire-and-forget.

In **Chapter 8** you intercepted the network — `route.fulfill()` for synthetic responses, `route.abort()` for connection failures, and `route.continue()` for partial intercepts.

In **Chapter 9** you took the suite to CI — headless env vars, the Vibium daemon lifecycle with `if: always()`, environment variables for base URLs, and recordings for debugging CI-only failures.

And now in **Chapter 10** you saw the third interface — MCP for agent-driven exploration and test generation, and how TypeScript and MCP complement each other in a real workflow.

The patterns you've learned — async/await with `try/finally`, `waitFor*` before assertions, Page Objects for DRY selectors, `Promise.all` for captures, atomic tests with `beforeEach`/`afterEach` — these compose directly into production test suites. Take them with you.
