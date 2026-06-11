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

Vitest prints a result table showing which tests passed, which failed, and how long each took. Every test ran with a fresh browser, in isolation, against a clean page state. If one test fails, the others still run.

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

In the next chapter we'll look at captures — intercepting browser dialogs, console output, and file downloads. These are the scenarios that require the most careful timing, and we'll see a pattern that looks a bit different from what we've done so far.
