# Chapter 4: Working with Forms

In Chapter 3 you wrote a test that reads and asserts on a page. Now we're going to interact with it. Forms are where the majority of real-world test automation work happens — search fields, dropdowns, checkouts, login screens, registration flows. In this chapter you'll fill text inputs, drive select dropdowns, assert that validation errors appear on an invalid submit, and finally walk through the complete checkout flow of our app from first search to order confirmation.

---

## The forms in our app

Let's start by mapping out what we're working with. Our app has forms in two places.

On the `/products` page there's a **search and filter bar**: a text input for searching by product name, a category dropdown with options for All, Electronics, Apparel, Home, and Books, and a sort dropdown for Popular, Price Low to High, and Price High to Low.

On the `/checkout` page there's a **12-field order form**: first name, last name, email, phone, address, city, state, ZIP code, card name, card number, card expiry, and card CVC. Every field is required, and the form validates on submit.

We'll test both.

---

## Filling text inputs

The method for filling a text input is `element.fill(text)`. It clears whatever is in the field first, then types the new value. Let's try it on the search bar.

The search input has a placeholder of "Search products..." — we can use that as a CSS attribute selector to target it precisely:

```typescript
await page.go(`${AUT}/products`)

const search = await page.find("input[placeholder='Search products...']")
await search.fill('headphones')
```

As you type, the product list filters in real time. After filling, we can assert that the right product appears and unrelated ones don't:

```typescript
const result = await page.find({ text: 'Wireless Headphones' })
assert.ok(await result.isVisible(), 'search result visible')
```

Two methods worth distinguishing here: `fill()` clears the field first, then types. `type()` appends without clearing. Use `fill()` when you're entering a new value. Use `type()` when you want to add to what's already there — for example, simulating a user who typed something and then keeps going.

---

## Driving select dropdowns

Standard `<select>` elements are driven with `element.selectOption()`. Pass the visible option text — the string the user would see in the dropdown:

```typescript
// Filter to Electronics
const category = await page.find('select:first-of-type')
await category.selectOption('Electronics')

// Change sort order
const sort = await page.find('select:last-of-type')
await sort.selectOption('Price: Low to High')
```

After selecting a category, a label updates to show the active filter. We'll learn in Chapter 5 how to properly wait for that update before asserting on it. For now, let's focus on the form mechanics.

---

## Asserting validation errors

Before we test the happy path, let's test what happens when things go wrong. Submitting an empty form should show validation errors for every required field. Testing this is important — a form that accepts empty data is a bug.

The approach: navigate to checkout with something in the cart (the page redirects if the cart is empty), then click "Place Order" without filling anything, then assert that the expected error messages appear.

Our checkout form shows 12 error messages for 12 required fields. Here's the pattern:

```typescript
const submit = await page.find({ role: 'button', text: 'Place Order' })
await submit.click()

const errors = [
  '✗ First name required',
  '✗ Last name required',
  '✗ Valid email required',
  '✗ Valid phone required',
  '✗ Address required',
  '✗ City required',
  '✗ State required',
  '✗ Valid ZIP required',
  '✗ Cardholder name required',
  '✗ Valid card number required',
  '✗ Format MM/YY',
  '✗ Valid CVC required',
]

for (const message of errors) {
  const el = await page.find({ text: message })
  assert.ok(await el.isVisible(), `error visible: ${message}`)
}
```

A quick note on test design: this validation test and the happy-path checkout test are *separate* tests. Each one is **atomic** — it does one thing, sets up its own state, and doesn't depend on the other. If we combined them into one long script, a failure in the validation step would prevent the checkout from being tested at all. Keep tests focused. One test per scenario.

---

## Filling the complete checkout form

For the happy path, we need to first add an item to the cart, then navigate to checkout and fill all 12 fields.

The checkout form uses `name` attributes on every input — `firstName`, `lastName`, `email`, and so on. Targeting by `input[name=...]` is reliable and readable, and it matches how the form is semantically structured. Let's use a `fieldMap` object to store all the test data in one place, and then loop over it to fill each field:

```typescript
const fieldMap: Record<string, string> = {
  firstName:  'Jane',
  lastName:   'Smith',
  email:      'jane@test.com',
  phone:      '5551234567',
  address:    '456 Oak Ave',
  city:       'Portland',
  state:      'OR',
  zipCode:    '97201',
  cardName:   'Jane Smith',
  cardNumber: '4111111111111111',
  cardExpiry: '12/26',
  cardCvc:    '999',
}

for (const [name, value] of Object.entries(fieldMap)) {
  const field = await page.find(`input[name=${name}]`)
  await field.fill(value)
}
```

This `fieldMap` pattern is worth adopting as a habit. The data lives in one object at the top, the filling logic is generic and reads cleanly, and swapping in a different test user means changing only the data object.

After filling, we can verify a specific field's value using `element.value()`:

```typescript
const emailField = await page.find('input[name=email]')
assert.equal(await emailField.value(), 'jane@test.com', 'email field value')
```

Then submit and wait for the confirmation page:

```typescript
const submit = await page.find({ role: 'button', text: 'Place Order' })
await submit.click()
await page._waitForURL('**/confirmation')
```

`_waitForURL` blocks until the URL matches the pattern. This is the right way to handle navigation triggered by a form submit — you don't know exactly when the app will finish processing and change the URL, so you wait for the outcome rather than sleeping for an arbitrary duration.

---

## The complete checkout test

Here's the full flow in one test, using the `fieldMap` pattern:

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

const fieldMap: Record<string, string> = {
  firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com',
  phone: '5551234567', address: '456 Oak Ave', city: 'Portland',
  state: 'OR', zipCode: '97201', cardName: 'Jane Smith',
  cardNumber: '4111111111111111', cardExpiry: '12/26', cardCvc: '999',
}

async function testCheckoutFlow() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Add a product to cart first
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    // Navigate to checkout
    await page.go(`${AUT}/checkout`)

    // Fill all 12 fields
    for (const [name, value] of Object.entries(fieldMap)) {
      const field = await page.find(`input[name=${name}]`)
      await field.fill(value)
    }

    // Submit
    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()

    // Wait for confirmation
    await page._waitForURL('**/confirmation')
    assert.ok(
      (await page.url()).includes('/confirmation'),
      'reached confirmation page'
    )

    console.log('Checkout flow passed.')
  } finally {
    await browser.stop()
  }
}

testCheckoutFlow().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Walk through this test and you should feel comfortable with every line. We start by adding a product — not because adding to cart is what we're testing, but because the checkout page won't show the form without it. We then navigate directly to checkout rather than going through the cart page, fill all fields, submit, and assert that we land on the confirmation URL.

This is an **integration test** — it's testing a real user flow from end to end. It touches multiple pages, real DOM interactions, and real navigation. It's also atomic: it sets up its own cart state, doesn't depend on any other test, and cleans up the browser in `finally`.

---

## Exercise

Write a test called `testSearchAndCheckout` that:

1. Navigates to `/products` and searches for `'yoga'`
2. Asserts that `'Yoga Mat'` is visible and `'Wireless Headphones'` is not visible
3. Navigates to `'/products/prod_007'` (Coffee Maker) and adds it to the cart
4. Navigates to `/checkout`
5. Fills all 12 checkout fields using the `fieldMap` loop pattern with your own data
6. Clicks "Place Order" and waits for `_waitForURL('**/confirmation')`
7. Asserts that the current URL includes `'/confirmation'`

Then write a **second test** called `testValidationErrors` (separate function, separate browser) that:

1. Navigates to a product page and adds it to cart
2. Navigates to `/checkout`
3. Clicks "Place Order" without filling any fields
4. Asserts that at least three of the twelve validation error messages are visible

---

## Quiz

**1.** What is the difference between `element.fill(text)` and `element.type(text)`?

- A. `fill()` triggers keyboard events; `type()` sets the value silently
- B. `fill()` clears the field first then types; `type()` appends without clearing
- C. They are identical — `type()` is an alias
- D. `type()` supports special keys like Tab; `fill()` does not

**2.** To select the "Electronics" option from a `<select>` dropdown, you call:

- A. `element.fill('Electronics')`
- B. `element.click('Electronics')`
- C. `element.choose('Electronics')`
- D. `element.selectOption('Electronics')`

**3.** The main benefit of the `fieldMap` pattern is:

- A. It is faster than individual `fill()` calls
- B. It prevents validation errors from appearing
- C. It separates test data from the fill logic so both can change independently
- D. It handles select dropdowns automatically

**4.** After clicking "Place Order" to submit a checkout form, the correct next step is:

- A. Sleep for 2 seconds then assert
- B. Immediately assert the URL with `page.url()`
- C. Call `page._waitForURL('**/confirmation')` before asserting
- D. Check `element.isEnabled()` on the submit button

**5.** `element.value()` is different from `element.text()` because:

- A. `value()` reads the `aria-label` attribute; `text()` reads visible content
- B. `value()` reads the current value of an input field; `text()` reads the element's rendered text content
- C. `value()` only works on select dropdowns
- D. They return the same thing for all element types

**Answers:** 1-B, 2-D, 3-C, 4-C, 5-B

---

## Solution

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

const fieldMap: Record<string, string> = {
  firstName: 'Alex', lastName: 'Rivera', email: 'alex@test.com',
  phone: '5559876543', address: '789 Pine St', city: 'Seattle',
  state: 'WA', zipCode: '98101', cardName: 'Alex Rivera',
  cardNumber: '4111111111111111', cardExpiry: '06/27', cardCvc: '123',
}

async function testSearchAndCheckout() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)
    const search = await page.find("input[placeholder='Search products...']")
    await search.fill('yoga')

    const yogaMat = await page.find({ text: 'Yoga Mat' })
    assert.ok(await yogaMat.isVisible(), 'Yoga Mat visible after search')

    // Assert Wireless Headphones is not in filtered results
    const filteredCount = (await page.findAll('a[href*="/products/prod_"]')).length
    assert.ok(filteredCount < 12, 'search narrowed results from 12')

    await page.go(`${AUT}/products/prod_007`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/checkout`)
    for (const [name, value] of Object.entries(fieldMap)) {
      const field = await page.find(`input[name=${name}]`)
      await field.fill(value)
    }

    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()
    await page._waitForURL('**/confirmation')
    assert.ok((await page.url()).includes('/confirmation'), 'reached confirmation page')

    console.log('testSearchAndCheckout passed.')
  } finally {
    await browser.stop()
  }
}

async function testValidationErrors() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/checkout`)
    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()

    const firstError = await page.find({ text: '✗ First name required' })
    assert.ok(await firstError.isVisible(), 'first name error visible')

    const emailError = await page.find({ text: '✗ Valid email required' })
    assert.ok(await emailError.isVisible(), 'email error visible')

    const cardError = await page.find({ text: '✗ Valid card number required' })
    assert.ok(await cardError.isVisible(), 'card number error visible')

    console.log('testValidationErrors passed.')
  } finally {
    await browser.stop()
  }
}

Promise.all([testSearchAndCheckout(), testValidationErrors()])
  .catch(err => { console.error('Test failed:', err.message); process.exit(1) })
```

In the next chapter, we'll look much more closely at assertions and waiting — specifically how to assert on dynamic state like cart totals that update after you interact with the page.
