# Chapter 8: Network Interception

Any test that calls a real API inherits the instability of that API. Slow responses, rate limits, flaky connections, data you can't predict — all of that becomes part of your test. Network interception breaks the dependency. You intercept an HTTP request before it leaves the browser and respond with data you define. No network required.

In this chapter we'll use `page.route()` to stub successful responses, simulate errors, and control partial intercepts where most requests pass through normally but one specific endpoint returns synthetic data.

---

## How page.route() works

`page.route(pattern, handler)` registers an interceptor on the current page. The pattern is a glob string matched against the full request URL. The handler is an async function that receives a `Route` object. You decide what to do with it:

- `route.fulfill(response)` — reply with your own response
- `route.abort()` — simulate a connection failure
- `route.continue()` — let the request through normally

```typescript
await page.route('**/api/products', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'prod_001', name: 'Wireless Headphones', price: 79.99 }]),
  })
})
```

Once registered, every request matching that pattern goes through your handler. The route persists for the lifetime of the page. Register it before navigating, and all matching requests from that navigation forward will be intercepted.

---

## Stubbing a successful response

Let's test that the products page correctly renders products from the API — but using data we control rather than the live server.

We'll stub the products endpoint to return exactly two items, then verify that exactly two product cards appear in the DOM:

```typescript
import { browser as vibium } from 'vibium'
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
          {
            id: 'prod_001', name: 'Wireless Headphones', price: 79.99,
            category: 'Electronics', rating: 4.5, inStock: true, stockCount: 15
          },
          {
            id: 'prod_007', name: 'Coffee Maker', price: 49.99,
            category: 'Home', rating: 4.2, inStock: true, stockCount: 8
          },
        ]),
      })
    })

    await page.go(`${AUT}/products`)

    const count = (await page.findAll('a[href*="/products/prod_"]')).length
    assert.equal(count, 2, 'stubbed response shows exactly 2 products')

    assert.ok(
      await (await page.find({ text: 'Wireless Headphones' })).isVisible(),
      'first product rendered'
    )
    assert.ok(
      await (await page.find({ text: 'Coffee Maker' })).isVisible(),
      'second product rendered'
    )

    console.log('Stub assertions passed.')
  } finally {
    await browser.stop()
  }
}

testStubProductList().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

This test runs in milliseconds because no real HTTP request leaves the browser. It passes even if the server is down. It always returns the same data, so assertions are deterministic. And because you control the response shape exactly, you can test edge cases — empty lists, maximum counts, missing fields — that would be impossible to trigger reliably against a real server.

---

## Simulating a network failure

Use `route.abort()` to simulate a connection failure. This is what happens when a request times out, DNS fails, or the server is completely unreachable. Testing this confirms your app doesn't crash or show a blank screen when the network is unavailable:

```typescript
async function testNetworkError() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/api/products*', async route => {
      await route.abort()
    })

    await page.go(`${AUT}/products`)

    // The app should show some kind of error or empty state
    const body = await page.find('body')
    const text = await body.text()
    assert.ok(text.length > 0, 'page rendered despite API failure')

    console.log('Network error handling verified.')
  } finally {
    await browser.stop()
  }
}
```

The assertion here is intentionally broad — we're checking that the page rendered *something* rather than hanging or crashing. In a real app you'd assert on the specific error message your UI shows, like "Unable to load products. Please try again."

---

## Simulating an HTTP error

`route.abort()` simulates a connection-level failure. For testing server-side error handling, simulate an HTTP 500 instead — the network worked, but the server responded with an error:

```typescript
await page.route('**/api/products*', async route => {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Internal Server Error' }),
  })
})
```

The difference matters. A 500 response tests that your app correctly handles a server error returned over a working connection. An `abort()` tests that it handles a lost connection. Both scenarios are real; both are worth testing.

---

## Partial intercepts: let most requests through

Sometimes you need to stub one specific endpoint while the rest of the app loads normally — static assets, fonts, scripts, and other APIs should all pass through. Use `route.continue()` for anything you don't want to intercept:

```typescript
await page.route('**/*', async route => {
  if (route.request().url().includes('/api/products')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),  // empty product list
    })
  } else {
    await route.continue()
  }
})
```

This pattern intercepts all requests with `'**/*'` but only overrides the products API. Everything else — the app's JavaScript, CSS, images, other endpoints — flows through normally. The products page will render its shell, the layout will look correct, but the product grid will be empty because you returned an empty array.

Why would you want an empty product list? To test that the app renders a "no products found" state rather than a blank section. Edge cases like empty data are exactly what network interception is designed for.

---

## When to use network interception vs real requests

Network interception is the right choice when:
- You need deterministic data — the same inputs produce the same outputs every time
- You're testing frontend behavior in response to specific server responses (errors, edge cases, loading states)
- You want fast tests that don't depend on server availability

Use real requests when:
- You're doing end-to-end testing of a complete flow through the stack
- You want to verify that the frontend and backend contract is intact
- You're running integration tests against a staging environment

Most test suites use both. Unit-level behavior tests use interception. Smoke tests and critical path tests use real requests.

In the next chapter we'll look at running your tests in CI — configuring headless mode, managing the Vibium daemon lifecycle in GitHub Actions, and using recordings to debug failures that only appear in CI.
