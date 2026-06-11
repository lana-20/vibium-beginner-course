# Chapter 5: Assertions and Waiting

In Chapter 3 you wrote your first assertions using `assert.ok` and `assert.equal`. In this chapter we're going to go deeper — covering all the element state methods Vibium provides, how to assert on attributes and element counts, and most importantly, how to wait for the page to settle before asserting on it. We'll close by writing a test that verifies cart totals update correctly after changing a quantity. That involves timing, dynamic DOM updates, and careful assertion ordering — all real challenges you'll face constantly.

---

## Why waiting matters so much

Here's the thing about browser automation that trips up almost everyone at first: the browser is asynchronous. When you click a button, the app might update the DOM in the same frame, or it might need to process a state update, run a reducer, re-render a React component, and *then* update the DOM. That could take anywhere from 5ms to 500ms depending on what the action triggers.

If your assertion runs before the update lands, the test fails. Not because the feature is broken — because your test was faster than the page.

Here's what the wrong approach looks like:

```typescript
await increase.click()
// asserting immediately — DOM may not have updated yet
const total = await page.find({ text: '$159.98' })
assert.ok(await total.isVisible(), 'total updated')
```

This test is a race condition. It'll pass most of the time and fail occasionally for no apparent reason. Those are the worst kind of failures — they erode trust in your test suite.

Here's the correct approach:

```typescript
await increase.click()
await page.find({ text: '$159.98' })  // polls until the text is in the DOM
const total = await page.find({ text: '$159.98' })
assert.ok(await total.isVisible(), 'total updated')
```

`page.find({ text })` polls until that exact string appears somewhere on the page. Once it does, you know the DOM has settled and your assertion is safe to run. This is the pattern you'll use after *every* action that causes a dynamic update.

---

## Element state methods

Once you have an element from `page.find()`, you have six state methods available. Let me show you each one and when to reach for it.

`isVisible()` returns true if the element is currently rendered on screen — not hidden with `display: none`, not outside the viewport, not covered by an overlay. This is the most useful check in all of UI testing:

```typescript
const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
assert.ok(await addToCart.isVisible(), 'Add to Cart button visible')
```

`isEnabled()` returns true if the element is interactive — not `disabled`, not in a loading state. This matters for buttons that get disabled while a form is submitting, or submit buttons that disable after the first click:

```typescript
assert.ok(await addToCart.isEnabled(), 'Add to Cart button enabled')
```

`isChecked()` is for checkboxes and radio buttons. Returns true if the element is currently checked. Use this to verify checkbox state after a click:

```typescript
const terms = await page.find({ role: 'checkbox', text: 'I agree to the terms' })
assert.ok(await terms.isChecked(), 'terms checkbox is checked')
```

`text()` returns the visible text content of the element. Use this when you need to assert the exact text value, not just presence:

```typescript
const price = await page.find('.product-price')
assert.equal(await price.text(), '$79.99', 'price is correct')
```

`value()` returns the current value of an input field — what's typed in it. This is different from `text()`, which reads the rendered text content. For inputs, always use `value()`:

```typescript
const email = await page.find('input[name=email]')
assert.equal(await email.value(), 'jane@test.com', 'email filled correctly')
```

`attr(name)` reads any HTML attribute. The most common use is checking `href` on links and `src` on images:

```typescript
const link = await page.find({ role: 'link', text: 'Products' })
const href = await link.attr('href')
assert.ok(href?.includes('/products'), 'nav link points to products page')
```

---

## Waiting for text and URL changes

The two most common waits in Vibium tests:

`page.find({ text })` locates an element by its text content and polls until it appears. Since `find` throws if the element isn't found within the timeout, using it as a wait is idiomatic — you don't need a separate `waitFor` call:

```typescript
// After a category filter click, wait for the count label to update
await page.find({ text: 'Showing 3 of 12 products' })

// You can set a tighter timeout if the update should be fast
await page.find({ text: 'Order confirmed' }, { timeout: 10_000 })
```

Note that `find({ text })` matches against DOM text nodes — not rendered text. CSS `text-transform: uppercase` is visual only. If the DOM says `"Showing 3 of 12 products"`, search for that exact string regardless of how it appears on screen.

`page._waitForURL(pattern)` blocks until the current URL matches a glob pattern. Use this after actions that trigger navigation — form submits, link clicks, button clicks that route to a new page:

```typescript
// After clicking Place Order
await page._waitForURL('**/confirmation')

// After clicking a product card
await page._waitForURL('**/products/prod_001')
```

The pattern uses `**` as a wildcard for any path prefix, so `'**/confirmation'` matches `https://automation-exercise.daisyladybug.com/confirmation` regardless of the base URL.

> **When find() times out:** If `page.find()` throws `TimeoutError: Timeout 30000ms exceeded`, it polled for 30 seconds and never found what it was looking for. Three things to check:
>
> 1. **Selector is wrong.** Run `vibium find text "exact text"` from the CLI against the running page to confirm the text exists in the DOM. Remember: `find({ text })` matches DOM text nodes, not CSS-rendered text — if the DOM says `"Showing 3 of 12 products"` but CSS renders it uppercase, you must pass the lowercase DOM string.
> 2. **Element isn't rendered yet.** A previous action didn't fully settle. Add `vibium.record()` to capture what's actually on screen at the moment of failure.
> 3. **Wrong page entirely.** Navigation went somewhere unexpected. Add `console.log(await page.url())` or `console.log(await page.title())` before the failing find to confirm you're looking at the right page.

---

## Asserting on counts

Sometimes the right assertion isn't about a specific element — it's about how many elements of a certain type are present. `page.findAll()` returns an array of all matching elements — take its `.length` to count:

```typescript
await page.go(`${AUT}/products`)
const productCount = (await page.findAll('a[href*="/products/prod_"]')).length
assert.equal(productCount, 12, '12 products on catalog page')
```

This is particularly useful for testing filter behavior — you can assert that the count changed:

```typescript
const category = await page.find('select:first-of-type')
await category.selectOption('Electronics')
await page.find({ text: 'Showing 3 of 12 products' })

const filtered = (await page.findAll('a[href*="/products/prod_"]')).length
assert.equal(filtered, 3, '3 products after Electronics filter')
```

---

## The complete cart totals test

Now let's put all of this together in a test that covers real dynamic behavior. Our app has a cart page where you can increment item quantities. When you click the increment button, the quantity updates, the subtotal updates, and the total updates. That's three separate DOM values that all change after one click.

Here's how to test it correctly:

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testCartTotals() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Start: add Wireless Headphones ($79.99) to cart
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()
    await page.go(`${AUT}/cart`)

    // Verify initial state
    assert.ok(
      await (await page.find({ text: '1 item · 1 product' })).isVisible(),
      'cart shows 1 item'
    )
    assert.ok(
      await (await page.find({ text: '$79.99' })).isVisible(),
      'unit price visible'
    )

    // Click the increment button
    const increase = await page.find({
      role: 'button',
      text: 'Increase Wireless Headphones quantity'
    })
    await increase.click()

    // Wait for all three values to update before asserting
    await page.find({ text: '2 items · 1 product' })
    await page.find({ text: '$159.98' })

    // Now assert on the settled state
    assert.ok(
      await (await page.find({ text: '2 items · 1 product' })).isVisible(),
      'cart shows 2 items'
    )
    assert.ok(
      await (await page.find({ text: '$159.98' })).isVisible(),
      'subtotal updated to $159.98'
    )
    assert.ok(
      await (await page.find({ text: '$175.98' })).isVisible(),
      'total updated to $175.98'
    )

    console.log('All assertions passed.')
  } finally {
    await browser.stop()
  }
}

testCartTotals().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Let me point out the key decision: we call `page.find({ text })` twice — once for the count label and once for the subtotal. You might wonder why. Because the DOM update that changes the count label might complete a few milliseconds before the subtotal recalculates. By waiting for both values explicitly, we know the page is fully settled before we assert on any of them.

The total `$175.98` includes a $16 shipping fee. We don't wait for that separately because by the time both `waitForText` calls resolve, that value is already in the DOM too.

---

## Debugging with recordings

One last thing for this chapter. When you're chasing a timing-related failure — your assertion fails intermittently and you can't reproduce it locally — this is exactly when `vibium.record()` pays off. Swap your `vibium.start()` for `vibium.record()`, run the test, and open the recording URL at `player.vibium.dev`. Scrub through the timeline to the moment the assertion fires and look at exactly what was in the DOM. You'll immediately see whether the `find({ text })` wait resolved too early.

We'll see this again in Chapter 9 when we talk about CI observability.

---

## Understanding flaky tests

A test is **flaky** if it passes sometimes and fails other times on the same code, without you changing anything. Flakiness is the most common pain point in browser test automation — and it's almost always a timing issue, not a real bug.

Here's what causes it and how to diagnose each case.

**Race between action and DOM update.** You click a button and immediately assert on a value that the click updates. The test passes when the update is fast, fails when it's slow. The fix is always the same: insert `page.find({ text })` or `page._waitForURL()` between the action and the assertion. Never assert immediately after an action that causes a DOM change.

```typescript
// Flaky: asserts before React re-renders
await addToCart.click()
assert.ok(await badge.isVisible(), 'cart badge')  // ← may fire before badge appears

// Stable: waits for the observable outcome
await addToCart.click()
await page.find({ text: '1 item' })  // ← blocks until the DOM reflects the action
assert.ok(await badge.isVisible(), 'cart badge')
```

**Element found before it's interactive.** `find()` returns as soon as the element exists in the DOM — but that's not the same as it being ready to receive input. On slow machines or CI, an input might be in the DOM but not yet enabled. Use `element.isEnabled()` if you're seeing `fill()` or `click()` silently fail on elements that intermittently aren't ready.

**Environment-specific timing.** Tests that pass locally but fail in CI are almost always timing issues — CI containers have less memory and slower I/O than your laptop. Do not add `sleep()` calls to fix these. Instead, find the DOM state that indicates the page has settled, and wait for that. Arbitrary sleeps hide the symptom; they don't fix the root cause.

**Truly flaky vs broken.** To distinguish an intermittent timing failure from a genuine bug, run the test ten times in a row (`vitest --repeat 10` or a loop in your shell). If it fails consistently — every run, in the same place — it's a real failure. If it fails one in five times, it's flaky. These require different responses: consistent failures need a code fix; flaky tests need a wait strategy adjustment.

When you can't reproduce flakiness locally, add `vibium.record()` to the test and run it in CI until you capture a failing run. The recording at `player.vibium.dev` shows you the DOM state at every step — you'll see exactly what was on screen at the moment the assertion fired.

In the next chapter, we're going to organize everything we've built so far into a real test suite — introducing Vitest, page objects, and the framework patterns that make a test codebase maintainable as it grows.

---

## Exercise

Write a test called `testProductFilter` that:

1. Navigates to `/products`
2. Selects "Electronics" from the category dropdown using `selectOption`
3. Uses `page.find({ text: 'Wireless Headphones' })` to wait for a result that should be visible after filtering
4. Asserts that `'Wireless Headphones'` is visible
5. Finds any element whose text would only appear in Electronics (e.g. a product name) and asserts it is visible
6. Uses `(await page.findAll('.product-card')).length` to count visible products and asserts the count is greater than 0

Then write a **second test** called `testCartTotal` (separate function) that:

1. Navigates to a product page and reads the product price text using `element.text()`
2. Adds the product to the cart
3. Navigates to `/cart`
4. Uses `page.find({ text })` to wait for the cart subtotal to appear
5. Asserts the subtotal element is visible

---

## Quiz

**1.** Why is `page.find({ text: 'Updated: 5 items' })` better than `assert.ok(await label.text(), ...)` immediately after a click?

- A. `find` is faster than reading text directly
- B. `find` waits for the text to appear in the DOM; the direct read may catch stale state before the update
- C. Direct text reads are deprecated in Vibium
- D. They are equivalent — use whichever is shorter

**2.** `assert.equal(actual, expected)` fails when:

- A. The values are equal by reference but not by value
- B. The values are not strictly equal (`!==`)
- C. The actual value is `null`
- D. The expected value is a string

**3.** `element.isVisible()` returns `false` when the element is:

- A. Found in the DOM but has `display: none`
- B. Found in the DOM and is on screen
- C. Found anywhere in the document tree
- D. The only element matching the selector

**4.** When you need to assert that an element does NOT exist on the page, the right approach is:

- A. `assert.equal(await element.isVisible(), false)`
- B. Call `page.find()` and catch the error if it throws
- C. Use `(await page.findAll(selector)).length === 0`
- D. Call `page.find()` and check `isVisible()` returns false

**5.** The key reason to call `page.find({ text })` before asserting on dynamic values is:

- A. It logs the assertion to the console
- B. It prevents the element from disappearing during the assertion
- C. It blocks until the text appears in the DOM, so the assertion fires on settled state
- D. It is required before any `assert.equal` call

**Answers:** 1-B, 2-B, 3-A, 4-C, 5-C
