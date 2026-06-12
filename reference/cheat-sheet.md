# Vibium API Cheat Sheet

Quick reference for every pattern used in the Vibium Beginner Course.

---

## Setup

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'
```

---

## Browser lifecycle

```typescript
// Start (visible browser, local dev)
const browser = await vibium.start({ headless: false })

// Start (headless, CI-aware)
const browser = await vibium.start({ headless: process.env.CI === 'true' })

// Record (captures replay URL)
const { browser, stop } = await vibium.record({ headless: true })
const url = await stop()   // call AFTER browser.stop()
console.log('Recording:', url)

// Always stop in finally
try {
  // test logic
} finally {
  await browser.stop()
}
```

---

## Context and page

```typescript
const context = await browser.newContext()
const page = await context.newPage()

// Two isolated sessions
const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()])
const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()])
```

---

## Navigation

```typescript
await page.go(`${AUT}/products`)
await page.go(`${AUT}/products/prod_001`)
await page._waitForURL('**/confirmation')   // wait for URL pattern

const url = await page.url()
const title = await page.title()
```

---

## Finding elements

```typescript
// Role + text — preferred for interactive elements
const btn = await page.find({ role: 'button', text: 'Add to Cart' })
const link = await page.find({ role: 'link', text: 'Products' })
const heading = await page.find({ role: 'heading', text: 'Products' })

// CSS selector — for inputs and structural targeting
const search = await page.find("input[placeholder='Search products...']")
const category = await page.find('select:first-of-type')
const field = await page.find('input[name=email]')

// Text only — returns outermost matching element; use role for interactive elements
const label = await page.find({ text: '1 item · 1 product' })

// All matching elements
const cards = await page.findAll('a[href*="/products/prod_"]')
const count = cards.length
```

---

## State methods

```typescript
await element.isVisible()    // true if rendered and on screen
await element.isEnabled()    // true if not disabled
await element.isChecked()    // true if checkbox/radio is checked

await element.text()         // visible text content
await element.value()        // current value of an input field
await element.attr('href')   // attribute value
```

---

## Actions

```typescript
await element.click()
await element.fill('text')          // clears field, then types
await element.type('text')          // appends without clearing
await element.selectOption('Label') // for <select> dropdowns
```

---

## Assertions

```typescript
assert.equal(actual, expected, 'label')
assert.ok(truthy, 'label')
assert.ok(await element.isVisible(), 'element visible')
assert.equal(await page.title(), 'expected title', 'title')
assert.ok((await page.url()).includes('/confirmation'), 'on confirmation page')
```

---

## Waiting patterns

```typescript
// Wait for text to appear (find() polls until element exists)
await page.find({ text: '2 items · 1 product' })

// Wait for URL
await page._waitForURL('**/confirmation')

// Pattern: action → wait → assert
await button.click()
await page.find({ text: 'Success' })          // ← wait for observable outcome
assert.ok(await banner.isVisible(), 'banner') // ← now assert
```

---

## Captures (Promise.all + fire-and-forget)

```typescript
// Dialog
const [result] = await Promise.all([
  page.capture.dialog('accept'),   // or 'dismiss'
  (async () => { trigger.click() })(),
])
// result.type  ('alert' | 'confirm' | 'prompt')
// result.message

// Console
const [messages] = await Promise.all([
  page.capture.console(),
  (async () => { trigger.click() })(),
])
// messages[].type  ('log' | 'warn' | 'error' | 'info')
// messages[].text

// Download
const [download] = await Promise.all([
  page.capture.download('/tmp/downloads'),
  (async () => { trigger.click() })(),
])
// download.suggestedFilename
// download.path
```

---

## Network interception

```typescript
// Stub response
await page.route('**/api/products*', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'prod_stub', name: 'Test Product' }]),
  })
})

// Simulate error
await page.route('**/api/products*', async route => {
  await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server Error' }) })
})

// Connection failure
await page.route('**/api/products*', async route => {
  await route.abort()
})

// Partial intercept — stub one, pass everything else through
await page.route('**/*', async route => {
  if (route.request().url().includes('/api/products')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  } else {
    await route.continue()
  }
})
```

---

## Vitest suite structure

```typescript
import { browser as vibium } from 'vibium'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Browser, Page } from 'vibium'

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

describe('Products', () => {
  it('shows search input', async () => {
    await page.go(`${AUT}/products`)
    const input = await page.find("input[placeholder='Search products...']")
    expect(await input.isVisible()).toBe(true)
  })
})
```

---

## vibium.record() in Vitest

```typescript
let stopRecording: (() => Promise<string>) | null = null

beforeEach(async () => {
  const recording = await vibium.record({ headless: process.env.CI === 'true' })
  browser = recording.browser
  stopRecording = recording.stop
  const context = await browser.newContext()
  page = await context.newPage()
})

afterEach(async () => {
  await browser.stop()        // close browser first
  if (stopRecording) {
    const url = await stopRecording()
    console.log('Recording:', url)
    stopRecording = null
  }
})
```

---

## Page Object pattern

```typescript
class ProductsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.go(`${AUT}/products`)
  }

  async search(query: string) {
    const input = await this.page.find("input[placeholder='Search products...']")
    await input.fill(query)
  }

  async filterByCategory(category: string) {
    const select = await this.page.find('select:first-of-type')
    await select.selectOption(category)
  }

  async getProductCount() {
    return (await this.page.findAll('a[href*="/products/prod_"]')).length
  }
}
```

---

## CI daemon lifecycle (GitHub Actions)

```yaml
- name: Start Vibium daemon
  run: vibium daemon start
  env:
    HOME: /root

- name: Run tests
  run: npm run test:ci
  env:
    CI: true
    HOME: /root

- name: Stop Vibium daemon
  if: always()              # runs even if tests failed
  run: vibium daemon stop
  env:
    HOME: /root
```

---

## Common mistakes

| Wrong | Right |
|-------|-------|
| `import vibium from 'vibium'` | `import { browser as vibium } from 'vibium'` |
| `browser.close()` | `browser.stop()` |
| `page.find({ css: '.selector' })` | `page.find('.selector')` |
| `element.select('option')` | `element.selectOption('option')` |
| `page.waitForText(...)` | `page.find({ text: ... })` |
| `page.count(selector)` | `(await page.findAll(selector)).length` |
| `page.waitForURL(...)` | `page._waitForURL(...)` |
| Assert immediately after click | Wait for observable DOM change first |
| `browser.stop()` in `try` | `browser.stop()` in `finally` |
| Awaited click inside capture | Fire-and-forget click inside `Promise.all` |

---

## See Also

| Resource | URL |
|----------|-----|
| Official JS API reference (68 methods · 10 categories) | [daisyladybug.com/vibium/javascript](https://www.daisyladybug.com/vibium/javascript/) |
| Official MCP tool reference (85 tools · 8 categories) | [daisyladybug.com/vibium/mcp](https://www.daisyladybug.com/vibium/mcp/) |
| Vibium architecture overview | [daisyladybug.com/vibium](https://www.daisyladybug.com/vibium/) |
