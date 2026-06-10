# Chapter 8: Network Interception

When a test depends on an external API, it inherits all the instability of that API: rate limits, flakiness, slow responses, and data you can't control. Network interception lets you break that dependency. You intercept the HTTP request before it leaves the browser and return a response you define — no network required.

---

## 8.1 page.route()

`page.route(pattern, handler)` registers an intercept. The pattern is a glob string matched against the full request URL. The handler receives a `Route` object with two methods:

- `route.fulfill(response)` — respond with synthetic data
- `route.abort()` — simulate a network failure (connection refused)

```typescript
await page.route('**/api/products', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'prod_001', name: 'Wireless Headphones', price: 79.99 }]),
  })
})
```

Once registered, every request matching the pattern goes through your handler instead of hitting the real server. Routes persist for the lifetime of the page, or until you unregister them.

---

## 8.2 Stubbing a Successful Response

Stub the product list API to return exactly two items, then verify the UI renders them:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testStubProductList() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/api/products*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'prod_001', name: 'Wireless Headphones', price: 79.99, category: 'Electronics', rating: 4.5, inStock: true, stockCount: 15 },
          { id: 'prod_007', name: 'Coffee Maker', price: 49.99, category: 'Home', rating: 4.2, inStock: true, stockCount: 8 },
        ]),
      })
    })

    await page.go(`${AUT}/products`)

    const count = await page.count('a[href*="/products/prod_"]')
    assert.equal(count, 2, 'stubbed response shows exactly 2 products')

    assert.ok(
      await (await page.find({ text: 'Wireless Headphones' })).isVisible(),
      'first product visible'
    )
    assert.ok(
      await (await page.find({ text: 'Coffee Maker' })).isVisible(),
      'second product visible'
    )

    console.log('Stub assertions passed.')
  } finally {
    await browser.close()
  }
}

testStubProductList().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

This test is fast (no real API call), deterministic (you control the data), and isolated (passes even if the server is down).

---

## 8.3 Simulating Errors with abort()

Use `route.abort()` to simulate a network failure and verify your app handles it gracefully:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testNetworkError() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/api/products*', async route => {
      await route.abort()
    })

    await page.go(`${AUT}/products`)

    // the app should show some kind of error or empty state
    // the exact text depends on the app's error handling
    const body = await page.find({ css: 'body' })
    const text = await body.text()
    assert.ok(text.length > 0, 'page rendered despite API failure')

    console.log('Network error handling verified.')
  } finally {
    await browser.close()
  }
}

testNetworkError().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

---

## 8.4 Simulating an Error Status

`route.fulfill()` can return any HTTP status, including 500:

```typescript
await page.route('**/api/products*', async route => {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Internal Server Error' }),
  })
})
```

This is more realistic than `abort()` for testing app error states: the network worked, but the server returned a failure.

---

## 8.5 Partial Intercepts — Pass Most Requests Through

Sometimes you only want to intercept one endpoint and let the rest through. Use `route.continue()` (or conditionally call `fulfill` vs `continue`):

```typescript
await page.route('**/*', async route => {
  if (route.request().url().includes('/api/products')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),  // empty list
    })
  } else {
    await route.continue()  // let all other requests through normally
  }
})
```

This pattern is useful when you need to stub one specific endpoint while the rest of the app loads normally — images, fonts, scripts, other APIs all pass through.
