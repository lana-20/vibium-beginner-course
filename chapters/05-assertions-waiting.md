# Chapter 5: Assertions and Waiting

In Chapter 3 you used `assert.ok(await element.isVisible())` to check whether something was on the page. In this chapter we go deeper: all the element state methods Vibium provides, how to assert on attributes and counts, and how to wait for specific page states before asserting. By the end you'll write a test that verifies the cart's running totals after a quantity change.

---

## 5.1 Why Waiting Matters

The browser is asynchronous. After you click a button, the page might update instantly or it might wait for a render cycle, a state update, or a network response. If your assertion runs before the update lands, it fails — not because the feature is broken, but because your test didn't wait long enough.

Vibium's approach: most actions (`click`, `fill`, `select`) automatically wait for the target element to be interactive before proceeding. But when you need to assert on something that appears *after* an action, you need to tell Vibium what to wait for.

The wrong approach:

```typescript
await button.click()
// BAD: may assert before the DOM updates
const total = await page.find({ text: '$159.98' })
assert.ok(await total.isVisible())
```

The right approach:

```typescript
await button.click()
await page.waitForText('$159.98')  // blocks until the text appears
const total = await page.find({ text: '$159.98' })
assert.ok(await total.isVisible())
```

---

## 5.2 Element State Methods

Once you have an element from `page.find()`, these methods tell you about its current state:

```typescript
const element = await page.find({ role: 'button', text: 'Add to Cart' })

await element.isVisible()   // → true/false — is it rendered on screen?
await element.isEnabled()   // → true/false — is it clickable? (not disabled)
await element.isChecked()   // → true/false — for checkboxes and radio buttons

await element.text()        // → the element's visible text content
await element.value()       // → the current value of an input field
await element.attr('href')  // → the value of any HTML attribute
```

Using them in assertions:

```typescript
await page.go('https://automation-exercise.daisyladybug.com/products/prod_001')

const price = await page.find({ text: '$79.99' })
assert.ok(await price.isVisible(), 'price visible')

const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
assert.ok(await addToCart.isEnabled(), 'Add to Cart button enabled')

const rating = await page.find({ text: '★★★★☆' })
assert.ok(await rating.isVisible(), 'rating stars visible')
```

---

## 5.3 waitForText and waitForURL

`page.waitForText(text)` blocks until the given string appears anywhere on the page. `page.waitForURL(pattern)` blocks until the current URL matches the pattern. Both accept a timeout option; the default is 30 seconds.

```typescript
// wait for text after a dynamic update
await page.waitForText('SHOWING 3 OF 12 PRODUCTS')

// wait for URL after navigation triggered by a click
await page.waitForURL('**/products/prod_001')

// with explicit timeout
await page.waitForText('Order confirmed', { timeout: 10_000 })
```

A pattern you'll use often: trigger an action, then wait before asserting.

```typescript
const category = await page.find({ css: 'select:first-of-type' })
await category.select('Electronics')
await page.waitForText('SHOWING 3 OF 12 PRODUCTS')

const heading = await page.find({ text: 'SHOWING 3 OF 12 PRODUCTS' })
assert.ok(await heading.isVisible(), 'filter result count visible')
```

---

## 5.4 Asserting on Counts and Attributes

Sometimes you need to assert that a certain number of elements exist, or that an element has a specific attribute value.

For counts, use `page.count()` with a CSS selector:

```typescript
await page.go('https://automation-exercise.daisyladybug.com/products')
const productCount = await page.count('a[href*="/products/prod_"]')
assert.equal(productCount, 12, '12 products on the catalog page')
```

For attributes, use `element.attr()`:

```typescript
const link = await page.find({ role: 'link', text: 'Products' })
const href = await link.attr('href')
assert.ok(href?.includes('/products'), 'nav link points to products page')
```

---

## 5.5 A Complete State Test

This test adds an item to the cart, increases the quantity, and asserts that the subtotal and total update correctly:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testCartTotals() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // add Wireless Headphones ($79.99) to cart
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/cart`)

    // initial state: qty 1, subtotal $79.99
    assert.ok(
      await (await page.find({ text: '1 ITEM · 1 PRODUCT' })).isVisible(),
      'cart shows 1 item'
    )
    assert.ok(
      await (await page.find({ text: '$79.99' })).isVisible(),
      'unit price visible'
    )

    // increase quantity to 2
    const increase = await page.find({ role: 'button', text: 'Increase Wireless Headphones quantity' })
    await increase.click()

    // wait for DOM to update
    await page.waitForText('2 ITEMS · 1 PRODUCT')
    await page.waitForText('$159.98')

    // assert updated totals
    assert.ok(
      await (await page.find({ text: '2 ITEMS · 1 PRODUCT' })).isVisible(),
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
    await browser.close()
  }
}

testCartTotals().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

The two `waitForText` calls after the click are the critical pattern: don't assert until the page reflects the new state. Without them the test would be racing the React re-render.
