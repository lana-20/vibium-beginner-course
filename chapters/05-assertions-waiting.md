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

In the next chapter, we're going to organize everything we've built so far into a real test suite — introducing Vitest, page objects, and the framework patterns that make a test codebase maintainable as it grows.
