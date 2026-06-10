# Chapter 6: Organizing Tests

Every chapter so far has used standalone scripts with `async function main()`. That works for learning, but once you have more than a few tests you need structure: a test runner that reports results, shared setup and teardown, and reusable page abstractions. This chapter introduces Vitest and the Page Object pattern.

---

## 6.1 From Scripts to a Test Suite

The problem with standalone scripts:

- Each file manages its own browser lifecycle — boilerplate in every file
- No built-in pass/fail reporting
- Running all tests means running each file manually
- No way to run only the tests for a specific feature

A test runner like Vitest solves all of this. It discovers test files automatically, runs them, reports results, and gives you hooks to share browser setup across tests.

---

## 6.2 Setting Up Vitest

Install Vitest if you haven't already:

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

Add a test script to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Test files go in the `tests/` directory and follow the naming pattern `*.test.ts`.

---

## 6.3 Browser Lifecycle with beforeEach and afterEach

In Vitest, `beforeEach` runs before every test in a suite and `afterEach` runs after. Use them to manage the browser lifecycle:

```typescript
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import vibium from 'vibium'

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
    await browser.close()
  })

  it('shows 12 products by default', async () => {
    await page.go(`${AUT}/products`)
    const count = await page.count('a[href*="/products/prod_"]')
    expect(count).toBe(12)
  })

  it('filters to 3 products when Electronics selected', async () => {
    await page.go(`${AUT}/products`)
    const select = await page.find({ css: 'select:first-of-type' })
    await select.select('Electronics')
    await page.waitForText('SHOWING 3 OF 12 PRODUCTS')
    expect(await page.find({ text: 'SHOWING 3 OF 12 PRODUCTS' })).toBeTruthy()
  })
})
```

Each test gets a fresh browser and page. Tests can't accidentally share state.

---

## 6.4 The Page Object Pattern

The tests above call `page.find({ css: 'select:first-of-type' })` directly. That's fine for two tests, but if you have twenty tests for the products page and the selector changes, you update it in twenty places.

The Page Object pattern wraps a page's interactions in a class:

```typescript
// src/ch06-organizing/pages/ProductsPage.ts
export class ProductsPage {
  constructor(private page: any) {}

  async goto() {
    await this.page.go('https://automation-exercise.daisyladybug.com/products')
  }

  async search(query: string) {
    const input = await this.page.find({ css: "input[placeholder='Search products...']" })
    await input.fill(query)
  }

  async filterByCategory(category: string) {
    const select = await this.page.find({ css: 'select:first-of-type' })
    await select.select(category)
  }

  async sortBy(option: string) {
    const select = await this.page.find({ css: 'select:last-of-type' })
    await select.select(option)
  }

  async productCount() {
    return this.page.count('a[href*="/products/prod_"]')
  }

  async isProductVisible(name: string) {
    const el = await this.page.find({ text: name })
    return el.isVisible()
  }
}
```

The test becomes readable:

```typescript
it('search returns the right product', async () => {
  const products = new ProductsPage(page)
  await products.goto()
  await products.search('headphones')
  expect(await products.isProductVisible('Wireless Headphones')).toBe(true)
})
```

A selector change in the products page means one edit in `ProductsPage.ts`, not scattered across many test files.

---

## 6.5 A Complete Organized Test Suite

```typescript
// src/ch06-organizing/tests/products.test.ts
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import vibium from 'vibium'
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
    await browser.close()
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
    await page.waitForText('SHOWING 3 OF 12 PRODUCTS')
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
    expect(await cart.itemCount()).toBe('1 ITEM · 1 PRODUCT')
  })
})
```

Run with:

```bash
npm test
```

Vitest prints a concise result table: passed, failed, and time per test.
