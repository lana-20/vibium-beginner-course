# Chapter 6: Organizing Tests

Every chapter so far has been standalone scripts — one file, one function, one `async function main()`. That's the right way to learn. But as your test suite grows, standalone scripts create real problems: every file manages its own browser, there's no shared reporting, running all tests means running each file manually. More importantly, if tests share browser state, you get flakiness that's very hard to debug.

This chapter is about building a proper test framework. We'll introduce Vitest as a test runner, look at how `beforeEach` and `afterEach` enforce the atomicity principle we talked about in Chapter 2, introduce the Page Object Pattern for organizing selectors and interactions, and talk through the OOP and DRY principles that make a test codebase maintainable as it grows.

---

## What's wrong with standalone scripts

Let me be specific about the problem. Here's a typical issue: you have five test files for the products page. Each one contains `page.find('select:first-of-type')` — the category dropdown selector. The app redesigns and the category select is now inside a `<form>` wrapper, so the correct selector is `form select:first-of-type`. You now update five files. You miss one. That test fails silently for weeks until someone notices.

That's the DRY problem: **Don't Repeat Yourself**. Duplication of selectors, duplication of setup code, duplication of assertions — every duplicate is a liability. When the app changes, you pay for every copy.

The solution is to centralize things that change together. Selectors for a page should live in one place. Browser setup should run from one definition. That's what we're building in this chapter.

---

## Installing Vitest

If you haven't already:

```bash
npm install --save-dev vitest
```

Add a `vitest.config.ts` to your project root:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  }
})
```

The `testTimeout` of 60 seconds covers the full browser lifecycle of a typical test. `hookTimeout` of 30 seconds covers `beforeEach` and `afterEach`. Update `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Test files live in `src/` and follow the naming pattern `*.test.ts`. Vitest discovers them automatically.

---

## beforeEach and afterEach — enforcing atomic tests

The `beforeEach` and `afterEach` hooks are Vitest's mechanism for shared setup and teardown. Combined with Vibium, they enforce the atomicity principle structurally rather than by convention.

Here's the pattern:

```typescript
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'

describe('Products page', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let page: any

  beforeEach(async () => {
    browser = await vibium.start({ headless: true })
    const context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await browser.stop()
  })

  it('shows 12 products by default', async () => {
    await page.go(`${AUT}/products`)
    expect((await page.findAll('a[href*="/products/prod_"]')).length).toBe(12)
  })

  it('filters to 3 products when Electronics selected', async () => {
    await page.go(`${AUT}/products`)
    const select = await page.find('select:first-of-type')
    await select.selectOption('Electronics')
    await page.find({ text: 'Showing 3 of 12 products' })
    expect(await page.find({ text: 'Showing 3 of 12 products' })).toBeTruthy()
  })
})
```

Every `it()` block gets a fresh browser and a new page. `beforeEach` runs before each one; `afterEach` closes the browser after. The second test has no way to be contaminated by the first — they each start from a clean slate.

This is what **atomic tests** look like in practice. We defined atomicity in Chapter 2: a test does one thing, sets up its own state, and tears down cleanly. `beforeEach`/`afterEach` enforce this structurally. You don't have to remember to do it — the framework does it for you.

If `afterEach` throws or the test crashes, the browser still gets closed because `afterEach` is always invoked. Compare this to putting `browser.stop()` at the end of an `it` block — if the test throws, you skip the close and leak a browser process.

---

## OOP and the Page Object Pattern

Now let's address the DRY problem. The solution is the **Page Object Pattern**, and it's one of the most important ideas in professional test automation.

Here's the core concept: a Page Object is a class that represents one page (or a section of a page) in your application. It knows the selectors. It knows the interactions. Tests call its methods. Tests never touch selectors directly.

Why a *class*? Because this is where OOP principles pay off in test code. A class bundles related state and behavior together:

- The selectors for the products page belong together. They change together when the page changes.
- The actions on the products page (search, filter, sort) belong together. They're all operations on the same page.
- The page object *encapsulates* this — it hides the implementation details and exposes a clean interface.

This maps directly to **Single Responsibility Principle**: the `ProductsPage` class has one job — representing the products page. Tests have one job — asserting on outcomes. Neither reaches into the other's territory.

Here's what a `ProductsPage` looks like:

```typescript
// src/ch06-organizing/pages/ProductsPage.ts
export class ProductsPage {
  private readonly AUT = 'https://automation-exercise.daisyladybug.com'

  constructor(private page: any) {}

  async goto() {
    await this.page.go(`${this.AUT}/products`)
  }

  async search(query: string) {
    const input = await this.page.find("input[placeholder='Search products...']")
    await input.fill(query)
  }

  async filterByCategory(category: string) {
    const select = await this.page.find('select:first-of-type')
    await select.selectOption(category)
  }

  async sortBy(option: string) {
    const select = await this.page.find('select:last-of-type')
    await select.selectOption(option)
  }

  async productCount() {
    return (await this.page.findAll('a[href*="/products/prod_"]')).length
  }

  async isProductVisible(name: string) {
    const el = await this.page.find({ text: name })
    return el.isVisible()
  }
}
```

The `page` object is injected through the constructor — we don't create it inside the class. This is **dependency injection**, another OOP principle: the class receives what it needs rather than creating it. The test creates the browser and page, then passes them in. This makes the class testable and keeps the lifecycle in one place.

Now look at how clean the test becomes:

```typescript
it('search finds a product by name', async () => {
  const products = new ProductsPage(page)
  await products.goto()
  await products.search('yoga')
  expect(await products.isProductVisible('Yoga Mat')).toBe(true)
  expect(await products.isProductVisible('Wireless Headphones')).toBe(false)
})
```

There's no CSS selector in the test. There's no implementation detail. The test reads like a description of user behavior: "go to products, search for yoga, check that Yoga Mat is visible and Wireless Headphones is not."

When the selector for the search input changes, you update one line in `ProductsPage.ts`. Done. Every test that uses `search()` benefits automatically.

---

## The CartPage object

Here's the `CartPage` for completeness. Notice the same pattern — constructor injection, domain-language method names:

```typescript
// src/ch06-organizing/pages/CartPage.ts
export class CartPage {
  private readonly AUT = 'https://automation-exercise.daisyladybug.com'

  constructor(private page: any) {}

  async goto() {
    await this.page.go(`${this.AUT}/cart`)
  }

  async itemCount() {
    const el = await this.page.find('.cart-summary')
    return el.text()
  }

  async subtotal() {
    const el = await this.page.find('.cart-subtotal')
    return el.text()
  }

  async increaseQuantity(productName: string) {
    const btn = await this.page.find({
      role: 'button',
      text: `Increase ${productName} quantity`,
    })
    await btn.click()
  }
}
```

---

## A complete organized test suite

Here's how all of this comes together in a real test file:

```typescript
// src/ch06-organizing/tests/products.test.ts
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'
import { ProductsPage } from '../pages/ProductsPage'
import { CartPage } from '../pages/CartPage'

const AUT = 'https://automation-exercise.daisyladybug.com'

describe('Products page', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let page: any

  beforeEach(async () => {
    browser = await vibium.start({ headless: true })
    const context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await browser.stop()
  })

  it('shows 12 products by default', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    expect(await products.productCount()).toBe(12)
  })

  it('filters to Electronics category', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.filterByCategory('Electronics')
    await page.find({ text: 'Showing 3 of 12 products' })
    expect(await products.isProductVisible('Wireless Headphones')).toBe(true)
  })

  it('search finds a product by name', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.search('yoga')
    expect(await products.isProductVisible('Yoga Mat')).toBe(true)
    expect(await products.isProductVisible('Wireless Headphones')).toBe(false)
  })

  it('adds a product to cart', async () => {
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    await addBtn.click()

    const cart = new CartPage(page)
    await cart.goto()
    expect(await cart.itemCount()).toBe('1 item · 1 product')
  })
})
```

Run it:

```bash
npm test
```

You'll see output like this:

```
 ✓ src/ch06-organizing/tests/products.test.ts (4 tests) 22s

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  14:32:11
   Duration  23.5s
```

Every test ran with a fresh browser, in isolation, against a clean page state. If one test fails, the others still run. A failing test looks like this:

```
 ✗ Products page > shows 12 products by default 6211ms
   → AssertionError: expected 11 to be 12

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
   Duration  23.4s
```

The test name tells you exactly which case failed. The assertion message tells you what was expected. No log scanning needed.

---

## Framework architecture recap

Let's zoom out for a second. What we've built in this chapter is a real test framework, and it applies three foundational principles:

**OOP**: Page Objects are classes. They bundle state (the page reference) and behavior (the interaction methods) together. This is how OOP makes code more maintainable — changes in one place propagate everywhere automatically.

**DRY**: Every selector appears exactly once, in the relevant Page Object. Every browser setup appears once, in `beforeEach`. No duplication.

**Atomic tests**: Every test is independent. `beforeEach`/`afterEach` enforce this structurally. You cannot write a test that depends on another test's state, because there is no shared state.

**Single Responsibility**: Page Objects handle selectors and interactions. Test functions handle assertions and test intent. Neither does the other's job.

---

## Parallel contexts: multiple tabs, one browser

Playwright runs tests in parallel across multiple worker processes, each with their own browser instance. Vibium can achieve a similar result within a single browser process using multiple `BrowserContext` objects. Each context is fully isolated — its own cookies, storage, and auth state — and can run an independent `Page`.

Here's what that looks like. Two users interacting with the app simultaneously, in the same browser process, without interfering with each other:

```typescript
const browser = await vibium.start({ headless: true })

// Two isolated contexts — like two separate incognito windows
const [ctx1, ctx2] = await Promise.all([
  browser.newContext(),
  browser.newContext(),
])

const [page1, page2] = await Promise.all([
  ctx1.newPage(),
  ctx2.newPage(),
])

// Both run in parallel — they share no state whatsoever
await Promise.all([
  page1.go(`${AUT}/products`),
  page2.go(`${AUT}/cart`),
])

await browser.stop()
```

Within a Vitest suite, Vitest handles this for you — each `it` block gets its own `beforeEach`-created context, and Vitest runs tests concurrently. But if you need to orchestrate multiple browser sessions *within a single test* — for example, testing a real-time feature where two users must be active simultaneously — the multi-context pattern is the right approach. Two contexts, one browser, complete isolation between them.

---

## Using vibium.record() inside Vitest

In Chapter 3 you saw `vibium.record()` in a standalone script — swap `vibium.start()` for `vibium.record()`, call `stop()` at the end, log the URL. In a Vitest suite, the lifecycle is managed by `beforeEach`/`afterEach`, not by a single function that runs top to bottom. Here's how to wire it in:

```typescript
import { browser as vibium } from 'vibium'
import { beforeEach, afterEach } from 'vitest'
import type { Browser, Page } from 'vibium'

let browser: Browser
let page: Page
let stopRecording: (() => Promise<string>) | null = null

beforeEach(async () => {
  const recording = await vibium.record({ headless: true })
  browser = recording.browser
  stopRecording = recording.stop
  const context = await browser.newContext()
  page = await context.newPage()
})

afterEach(async () => {
  await browser.stop()
  if (stopRecording) {
    const url = await stopRecording()
    console.log('Recording:', url)
    stopRecording = null
  }
})
```

Two things to notice. First, `stop()` is called *after* `browser.stop()` — the browser must close before the recording can be finalized and uploaded. Second, `stopRecording` is held in the outer scope so `afterEach` can reach it regardless of whether the test passed or failed.

In CI, the recording URL appears in the step logs. When a test fails, open the URL and scrub to the failing assertion. You'll see exactly what was on screen at that moment — which DOM node was missing, which value was wrong, which element wasn't visible. This is the complete observability loop: Vitest reports which test failed, the recording shows why.

For day-to-day local development, keep `vibium.start()` — you can watch the browser directly. Switch the suite to `vibium.record()` when you're debugging a CI-only failure or want a permanent record of a test run.

In the next chapter we'll look at captures — intercepting browser dialogs, console output, and file downloads. These are the scenarios that require the most careful timing, and we'll see a pattern that looks a bit different from what we've done so far.

---

## Exercise

Add a `CartPage` class to the page objects you built in this chapter. It should have at least three methods:

1. `goto()` — navigates to `/cart`
2. `getItemCount()` — returns the text of the cart item count element
3. `getSubtotal()` — returns the text of the subtotal value element

Then write a Vitest test file with two tests that use both `ProductsPage` and `CartPage`:

1. **`searches and finds a product`** — uses `ProductsPage` to search for `'yoga'`, asserts `'Yoga Mat'` is visible
2. **`adds a product and checks cart`** — navigates to a product detail page, clicks "Add to Cart", creates a `CartPage`, calls `goto()`, and asserts `getItemCount()` is not empty

Use `beforeEach`/`afterEach` for browser lifecycle. Every assertion must have a label.

---

## Quiz

**1.** The main purpose of a Page Object class is:

- A. To run tests faster by caching DOM lookups
- B. To centralize selectors and interaction logic so tests don't hardcode them
- C. To replace `beforeEach` and `afterEach`
- D. To add type safety to assertion calls

**2.** `beforeEach` and `afterEach` in Vitest enforce test atomicity by:

- A. Running tests sequentially so they cannot interfere
- B. Creating a fresh browser context before each test and closing it after
- C. Resetting the application state on the server
- D. Skipping tests that depend on each other

**3.** A Vitest test is identified in output by:

- A. The test file name only
- B. The `describe` block name and the `it` string, combined
- C. The line number of the `it` call
- D. The variable name of the `page` object

**4.** The Page Object Pattern follows Single Responsibility by ensuring:

- A. Each test file imports exactly one Page Object
- B. Selectors live in Page Objects and assertions live in test functions
- C. Page Objects never use `async/await`
- D. Tests cannot share Page Object instances

**5.** `Promise.all([ctx1.newPage(), ctx2.newPage()])` is useful when you need to:

- A. Run two tests in the same browser context
- B. Create two pages that share cookies
- C. Simulate two independent users acting simultaneously in one browser
- D. Run Vitest tests in parallel processes

**Answers:** 1-B, 2-B, 3-B, 4-B, 5-C

---

## Solution

```typescript
// src/ch06-organizing-tests/pages/CartPage.ts
import type { Page } from 'vibium'

const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'

export class CartPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.go(`${AUT}/cart`)
  }

  async getItemCount() {
    const summary = await this.page.find('.cart-summary-count, [class*="count"]')
    return summary.text()
  }

  async getSubtotal() {
    const el = await this.page.find('[class*="subtotal"], [data-testid="subtotal"]')
    return el.text()
  }
}
```

```typescript
// src/ch06-organizing-tests/cart.test.ts
import { browser as vibium } from 'vibium'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Browser, Page } from 'vibium'
import { ProductsPage } from './pages/ProductsPage'
import { CartPage } from './pages/CartPage'

const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'

let browser: Browser
let page: Page

beforeEach(async () => {
  browser = await vibium.start({ headless: process.env.CI === 'true' })
  const context = await browser.newContext()
  page = await context.newPage()
})

afterEach(async () => {
  await browser.stop()
})

describe('Products and Cart', () => {
  it('searches and finds a product', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.search('yoga')
    const yogaMat = await page.find({ text: 'Yoga Mat' })
    expect(await yogaMat.isVisible()).toBe(true)
  })

  it('adds a product and checks cart', async () => {
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    await addBtn.click()

    const cart = new CartPage(page)
    await cart.goto()
    // wait for cart to render
    const summary = await page.find({ text: '1 item' })
    expect(await summary.isVisible()).toBe(true)
  })
})
```

> **Note on `getItemCount()` and `getSubtotal()`:** The exact selector for cart totals depends on the app's DOM structure. Use the Vibium CLI (`vibium find text "1 item"`) against the live cart page to find the exact element and update the selectors accordingly.
