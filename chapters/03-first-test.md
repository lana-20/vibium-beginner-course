# Chapter 3: Your First Test

We've covered the landscape and the architecture. Now let's write actual code. In this chapter I'm going to walk you through installing Vibium, navigating to the app we'll be testing throughout this course, reading information from the page, and writing your first real assertion. By the end you'll have a complete, runnable test that passes, and you'll know exactly what to do when it fails.

---

## Prerequisites

Before you install anything, make sure your machine has:

- **Node.js 18 or later.** Run `node --version` to check. If it's not installed, go to nodejs.org and download the LTS release — that's the stable, recommended version.
- **npm** ships bundled with Node.js. If Node is installed, npm is already there.
- **A code editor.** VS Code works well for TypeScript — it gives you autocomplete and inline type errors for everything in this course.

That's all. Vibium manages its own browser binaries internally, so you don't need to install Chrome separately.

---

## Installing Vibium

Let's get the project set up. Open your terminal and create a new directory for your course work:

```bash
mkdir my-vibium-tests
cd my-vibium-tests
npm init -y
```

Now install Vibium and `tsx`. `tsx` lets you run TypeScript files directly from the terminal without a separate compile step — we'll use it for every example in this course:

```bash
npm install vibium
npm install --save-dev tsx typescript
```

One more thing: a `tsconfig.json`. Create this file in your project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

That's everything. Notice that we didn't install a browser, configure a WebDriver path, or set environment variables. Vibium manages its own browser binaries internally. When you first use it, it downloads what it needs automatically.

---

## Your first navigation

Let's make sure everything works. Create a file at `src/ch03-first-test/01-navigate-and-read.ts` and type this out:

```typescript
import { browser as vibium } from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.go(AUT)

  console.log('navigated successfully')
  await browser.stop()
}

main()
```

Run it:

```bash
npx tsx src/ch03-first-test/01-navigate-and-read.ts
```

Go ahead and run that now. A browser window will open, navigate to the app, and close. You'll see "navigated successfully" in your terminal. That's all this does — but it confirms your setup is working.

The key option to notice is `headless: false`. During development and learning, always keep this — you want to see what the browser is doing. Once your tests are solid, you can switch to `headless: true` for speed, and that's what we'll do in CI in Chapter 9.

> **What's happening behind the scenes:** When `vibium.start()` is called, Vibium quietly starts a background daemon process — a lightweight service that manages Chrome on the client's behalf. Your TypeScript code sends commands to the daemon; the daemon talks to Chrome. Locally this is automatic and invisible. You'll need to manage the daemon lifecycle explicitly when running tests in CI, and Chapter 9 covers exactly how. For now, it just works.

---

---

## Reading the page

Navigating is a start, but tests need to read the page to know what's there. Vibium gives you two primary ways to do this: `page.title()` and `page.find()`.

`page.title()` returns the document title — the text you see in the browser tab. Let's check what it returns for our app:

```typescript
const title = await page.title()
console.log(title)
// "automation-exercise | E-commerce Testing Sandbox"
```

`page.find()` locates an element and gives you an object you can inspect and interact with. Here's how you'd find the main heading and read its text:

```typescript
const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
const headingText = await heading.text()
console.log(headingText)
// "automation-exercise"
```

We're using `{ role: 'heading', text: '...' }` here rather than a CSS selector. As we discussed in Chapter 2, role-plus-text locators stay stable when the page's structure changes. The browser confirms there's exactly one heading with this text — regardless of what HTML tag or class it uses.

---

## Your first assertion

Reading the page is useful for debugging and exploration. But the whole point of a test is to *verify* that what you see matches what you expect. That's what assertions do — they check a condition, and if it's false, they stop the test immediately with a clear error message.

Node.js ships with a built-in `assert` module. We don't need a testing framework yet — we'll introduce one in Chapter 6. For now, `assert` is all we need:

```typescript
import assert from 'node:assert/strict'
```

The `/strict` import means all comparisons use strict equality (`===`), and failed assertions throw errors with helpful messages that tell you exactly what went wrong.

Two assertion methods you'll use constantly:

`assert.equal(actual, expected)` checks that two values are identical:

```typescript
const title = await page.title()
assert.equal(title, 'automation-exercise | E-commerce Testing Sandbox', 'page title')
console.log('✓ page title correct')
```

`assert.ok(value)` checks that a value is truthy — anything other than `false`, `null`, `undefined`, `0`, or an empty string:

```typescript
const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
assert.ok(await heading.isVisible(), 'hero heading is visible')
console.log('✓ hero heading is visible')
```

Notice the third argument to both — a string label. This appears in the error message when the assertion fails, so you can immediately identify *which* assertion failed without counting lines. Always provide a label. It costs nothing and saves real debugging time.

---

## A complete test with five assertions

Now let's put everything together into a properly structured test. There are a few habits I want you to establish right from the start, because they'll matter more and more as your test suite grows:

**Use `try/finally` for cleanup.** The browser always needs to close — whether the test passes, fails, or throws an unexpected error. `finally` runs in all three cases, so put `browser.stop()` there.

**Call `process.exit(1)` on failure.** This ensures CI systems know the test failed. Without a non-zero exit code, your CI pipeline will think everything is fine even when it isn't.

**Give every assertion a label.** The third argument to `assert.equal` and `assert.ok` shows up in failure messages. Use it.

Here's the complete test:

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function testHomepage() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)

    assert.equal(
      await page.title(),
      'automation-exercise | E-commerce Testing Sandbox',
      'page title'
    )

    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    assert.ok(await hero.isVisible(), 'hero heading visible')

    const featured = await page.find({ role: 'heading', text: 'Featured Products' })
    assert.ok(await featured.isVisible(), 'Featured Products section visible')

    const product = await page.find({ text: 'Wireless Headphones' })
    assert.ok(await product.isVisible(), 'first featured product visible')

    const cta = await page.find({ role: 'link', text: 'Explore Products' })
    assert.ok(await cta.isVisible(), 'Explore Products CTA visible')

    console.log('All assertions passed.')
  } finally {
    await browser.stop()
  }
}

testHomepage().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Let me walk through what each assertion is doing and *why* it's there:

The **page title** assertion is a smoke test. If navigation failed completely, or if the wrong page loaded, the title will be wrong and this catches it immediately.

The **hero heading** assertion checks rendered state, not just DOM presence. `isVisible()` returns true only if the element is actually rendered on screen — not hidden with `display: none`, not outside the viewport. Just finding the element is not enough; this confirms the user would actually see it.

The **Featured Products heading** confirms the page rendered past the hero section. It's testing that the page structure is intact, not just the first thing you see.

The **product name** assertion confirms that product data actually loaded. A blank products section would pass the heading check but fail here.

The **Explore Products CTA** confirms the main call-to-action is present. It's the primary action we'd expect a user to take from this page.

Five assertions, five different things confirmed. That's a solid homepage smoke test.

---

## Running it and reading a failure

Add a script to your `package.json` to make running this easier:

```json
"scripts": {
  "ch03:complete": "npx tsx src/ch03-first-test/03-complete-test.ts"
}
```

Run it:

```bash
npm run ch03:complete
```

You'll see the browser open and move through the page quickly, then close. In the terminal: `All assertions passed.`

Now I want you to see what a failure looks like, because reading test failures is a skill. Change one assertion to something wrong — let's say assert the title equals `"wrong title"`:

```typescript
assert.equal(await page.title(), 'wrong title', 'page title')
```

Run it again. You'll see:

```
Test failed: Expected values to be strictly equal:
+ actual - expected

+ 'automation-exercise | E-commerce Testing Sandbox'
- 'wrong title'
```

The `+` line is what you actually got. The `-` line is what you expected. The assertion label "page title" tells you which check failed. This is a clear, actionable failure message — you know exactly what the problem is without looking at anything else. Change it back to the correct value and run it one more time to confirm the test is green.

## Recording your test for review

There's one more tool I want to show you before we move on, because it transforms how you debug. Vibium has a built-in test recorder. When you wrap your test in `vibium.record()`, it captures every browser action, DOM state, and network event as the test runs, and saves it as a session you can replay.

Here's how to use it:

```typescript
import { browser as vibium } from 'vibium'

async function main() {
  const { browser, stop } = await vibium.record({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)
    // ... your test logic
  } finally {
    await browser.stop()
    const url = await stop()
    console.log('Recording:', url)
  }
}
```

`stop()` uploads the recording and returns a URL at `player.vibium.dev`. Open that link in any browser and you get an interactive replay — you can scrub forward and backward through every step, inspect what was in the DOM at each point, see which network requests fired, and click on any element to see its state at that moment. Think of it as a time machine for your test run.

This is similar in spirit to Playwright's trace recorder, but you don't need to configure anything extra — it's built into the Vibium API. The most valuable use case is **debugging failures on CI**: when a test passes locally but fails in CI, you can add `vibium.record()` to the CI run, get the URL from the logs, and replay exactly what happened. No more guessing from stack traces.

For local development, keep `vibium.start()` as you've been doing — you can see the browser directly. Switch to `vibium.record()` when you need to share a test run with a teammate, or when you want a permanent record of what a passing test looks like so you can compare it later against a failure.

In the next chapter we'll move from reading the page to interacting with it — filling in search fields, driving dropdowns, submitting forms, and asserting validation behavior. Forms are where most real-world testing happens, so that's an important one.

---

## Exercise

Write a complete test for the `/products` page. Name the function `testProductsPage`. It should:

1. Navigate to `automation-exercise.daisyladybug.com/products`
2. Assert the page title equals `'automation-exercise | E-commerce Testing Sandbox'`
3. Find the heading with text `'Products'` and assert it is visible
4. Find any product name visible on the page (e.g. `'Wireless Headphones'`) and assert it is visible
5. Find the search input using `"input[placeholder='Search products...']"` and assert it is enabled
6. Assert that the category select dropdown is visible using `'select:first-of-type'`

Use `try/finally`, label every assertion, and end with `.catch(err => { process.exit(1) })`.

Then introduce a deliberate failure in one assertion — wrong expected value — run the script, read the error output, then fix it.

---

## Quiz

**1.** What does `assert.ok(value, label)` check?

- A. That `value` strictly equals `true`
- B. That `value` is truthy — anything other than `false`, `null`, `undefined`, `0`, or `""`
- C. That `value` is not null or undefined only
- D. That `value` equals the string `"ok"`

**2.** Why must every standalone test script call `process.exit(1)` on failure?

- A. It is required for async functions to resolve
- B. To log the error to a file
- C. To ensure CI receives a non-zero exit code and marks the build as failed
- D. To prevent the Vibium daemon from remaining alive

**3.** The third argument to `assert.equal(actual, expected, 'label')` is:

- A. A comparison mode flag
- B. A custom error class
- C. A timeout in milliseconds
- D. A label that appears in the error message when the assertion fails

**4.** What does `vibium.record()` return that `vibium.start()` does not?

- A. A headless browser instance
- B. A `stop` function that uploads the session and returns a player URL
- C. A browser with network interception pre-configured
- D. A browser that runs in a separate process

**5.** `headless: false` causes Vibium to:

- A. Disable network requests during the test
- B. Run the browser without JavaScript enabled
- C. Skip the daemon startup step
- D. Open a visible browser window on your screen

**Answers:** 1-B, 2-C, 3-D, 4-B, 5-D

---

## Solution

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testProductsPage() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)

    assert.equal(
      await page.title(),
      'automation-exercise | E-commerce Testing Sandbox',
      'page title'
    )

    const heading = await page.find({ role: 'heading', text: 'Products' })
    assert.ok(await heading.isVisible(), 'Products heading visible')

    const product = await page.find({ text: 'Wireless Headphones' })
    assert.ok(await product.isVisible(), 'product name visible')

    const search = await page.find("input[placeholder='Search products...']")
    assert.ok(await search.isEnabled(), 'search input enabled')

    const category = await page.find('select:first-of-type')
    assert.ok(await category.isVisible(), 'category select visible')

    console.log('All assertions passed.')
  } finally {
    await browser.stop()
  }
}

testProductsPage().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

To see a deliberate failure, change the title assertion to:
```typescript
assert.equal(await page.title(), 'wrong title', 'page title')
```

The output will be:
```
Test failed: Expected values to be strictly equal:
+ actual - expected

+ 'automation-exercise | E-commerce Testing Sandbox'
- 'wrong title'
```

The label `'page title'` tells you which assertion failed. The `+` line is what you got; the `-` line is what you expected.
