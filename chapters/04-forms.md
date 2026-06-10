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

const search = await page.find({ css: "input[placeholder='Search products...']" })
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

Standard `<select>` elements are driven with `element.select()`. Pass the visible option text — the string the user would see in the dropdown:

```typescript
// Filter to Electronics
const category = await page.find({ css: 'select:first-of-type' })
await category.select('Electronics')

// Change sort order
const sort = await page.find({ css: 'select:last-of-type' })
await sort.select('Price: Low to High')
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
  const field = await page.find({ css: `input[name=${name}]` })
  await field.fill(value)
}
```

This `fieldMap` pattern is worth adopting as a habit. The data lives in one object at the top, the filling logic is generic and reads cleanly, and swapping in a different test user means changing only the data object.

After filling, we can verify a specific field's value using `element.value()`:

```typescript
const emailField = await page.find({ css: 'input[name=email]' })
assert.equal(await emailField.value(), 'jane@test.com', 'email field value')
```

Then submit and wait for the confirmation page:

```typescript
const submit = await page.find({ role: 'button', text: 'Place Order' })
await submit.click()
await page.waitForURL('**/confirmation')
```

`waitForURL` blocks until the URL matches the pattern. This is the right way to handle navigation triggered by a form submit — you don't know exactly when the app will finish processing and change the URL, so you wait for the outcome rather than sleeping for an arbitrary duration.

---

## The complete checkout test

Here's the full flow in one test, using the `fieldMap` pattern:

```typescript
import vibium from 'vibium'
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
      const field = await page.find({ css: `input[name=${name}]` })
      await field.fill(value)
    }

    // Submit
    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()

    // Wait for confirmation
    await page.waitForURL('**/confirmation')
    assert.ok(
      (await page.url()).includes('/confirmation'),
      'reached confirmation page'
    )

    console.log('Checkout flow passed.')
  } finally {
    await browser.close()
  }
}

testCheckoutFlow().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Walk through this test and you should feel comfortable with every line. We start by adding a product — not because adding to cart is what we're testing, but because the checkout page won't show the form without it. We then navigate directly to checkout rather than going through the cart page, fill all fields, submit, and assert that we land on the confirmation URL.

This is an **integration test** — it's testing a real user flow from end to end. It touches multiple pages, real DOM interactions, and real navigation. It's also atomic: it sets up its own cart state, doesn't depend on any other test, and cleans up the browser in `finally`.

In the next chapter, we'll look much more closely at assertions and waiting — specifically how to assert on dynamic state like cart totals that update after you interact with the page.
