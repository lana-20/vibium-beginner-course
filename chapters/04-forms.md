# Chapter 4: Working with Forms

Chapter 3 gave you a complete test for the homepage. In this chapter we go deeper into interacting with the app: filling text inputs, working with select dropdowns, asserting on validation errors, and writing a test that covers a real form submission flow. By the end you'll have tests for both the product search form and the checkout form.

---

## 4.1 The Forms We'll Work With

The automation-exercise app has forms in two places:

**Products page** (`/products`) — a search bar and two dropdowns:
- A text input for searching by product name
- A `<select>` for filtering by category (All, Electronics, Apparel, Home, Books)
- A `<select>` for sorting (Popular, Price: Low to High, Price: High to Low)

**Checkout page** (`/checkout`) — a 12-field form split into billing address and payment information:
- Billing: First Name, Last Name, Email, Phone, Address, City, State, ZIP
- Payment: Cardholder Name, Card Number, Expiry, CVC
- Submit button: "Place Order"

The checkout form has required-field validation. If you submit with empty fields you get inline error messages like "✗ First name required" and "✗ Valid email required".

---

## 4.2 Filling Text Inputs

You already used `element.fill()` in Chapter 3 for assertions. Here it drives actual user input.

Locate the search input by its placeholder, then fill it:

```typescript
await page.go('https://automation-exercise.daisyladybug.com/products')

const search = await page.find({ css: "input[placeholder='Search products...']" })
await search.fill('headphones')
```

After `fill()`, the products list filters in real time. Assert that the expected product appears and others disappear:

```typescript
const result = await page.find({ text: 'Wireless Headphones' })
assert.ok(await result.isVisible(), 'search result visible')

const other = await page.find({ text: 'Premium T-Shirt' })
assert.ok(!await other.isVisible(), 'unrelated product hidden')
```

`fill()` clears the field before typing. If you need to append text instead, use `element.type()`.

---

## 4.3 Working with Select Dropdowns

The category and sort dropdowns are standard `<select>` elements. Use `element.select()` with the visible option text:

```typescript
const category = await page.find({ css: 'select:first-of-type' })
await category.select('Electronics')
```

After selecting, assert the page reflects the filter. The heading updates to show the active category:

```typescript
const heading = await page.find({ text: 'Electronics' })
assert.ok(await heading.isVisible(), 'Electronics filter active')
```

The sort dropdown works the same way:

```typescript
const sort = await page.find({ css: 'select:last-of-type' })
await sort.select('Price: Low to High')
```

---

## 4.4 Filling the Checkout Form

The checkout inputs all have `name` attributes, which makes them easy to locate precisely:

```typescript
const fields = {
  firstName:   await page.find({ css: 'input[name=firstName]' }),
  lastName:    await page.find({ css: 'input[name=lastName]' }),
  email:       await page.find({ css: 'input[name=email]' }),
  phone:       await page.find({ css: 'input[name=phone]' }),
  address:     await page.find({ css: 'input[name=address]' }),
  city:        await page.find({ css: 'input[name=city]' }),
  state:       await page.find({ css: 'input[name=state]' }),
  zipCode:     await page.find({ css: 'input[name=zipCode]' }),
  cardName:    await page.find({ css: 'input[name=cardName]' }),
  cardNumber:  await page.find({ css: 'input[name=cardNumber]' }),
  cardExpiry:  await page.find({ css: 'input[name=cardExpiry]' }),
  cardCvc:     await page.find({ css: 'input[name=cardCvc]' }),
}

await fields.firstName.fill('Jane')
await fields.lastName.fill('Smith')
await fields.email.fill('jane@test.com')
await fields.phone.fill('5551234567')
await fields.address.fill('456 Oak Ave')
await fields.city.fill('Portland')
await fields.state.fill('OR')
await fields.zipCode.fill('97201')
await fields.cardName.fill('Jane Smith')
await fields.cardNumber.fill('4111111111111111')
await fields.cardExpiry.fill('12/26')
await fields.cardCvc.fill('999')
```

After filling, you can read a field's current value back with `element.value()`:

```typescript
const emailValue = await fields.email.value()
assert.equal(emailValue, 'jane@test.com', 'email field value')
```

---

## 4.5 Asserting Validation Errors

To test that the form validates correctly, submit it empty and assert that the error messages appear.

The form shows messages like "✗ First name required" and "✗ Valid email required" after a failed submission:

```typescript
await page.go('https://automation-exercise.daisyladybug.com/checkout')

const submit = await page.find({ role: 'button', text: 'Place Order' })
await submit.click()

const firstNameError = await page.find({ text: '✗ First name required' })
assert.ok(await firstNameError.isVisible(), 'first name error shown')

const emailError = await page.find({ text: '✗ Valid email required' })
assert.ok(await emailError.isVisible(), 'email error shown')
```

This tests the validation layer independently from the happy path — an important distinction. You want a separate test that confirms valid data passes, and a separate test that confirms invalid data fails with the right messages.

---

## 4.6 A Complete Form Test

Here's a full test that covers the search filter and checkout submission:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testSearchAndCheckout() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // ── Search filter ──────────────────────────────────────
    await page.go(`${AUT}/products`)

    const search = await page.find({ css: "input[placeholder='Search products...']" })
    await search.fill('headphones')
    assert.ok(
      await (await page.find({ text: 'Wireless Headphones' })).isVisible(),
      'search result visible'
    )

    const category = await page.find({ css: 'select:first-of-type' })
    await category.select('Electronics')
    assert.ok(
      await (await page.find({ text: 'Electronics' })).isVisible(),
      'Electronics filter active'
    )

    // ── Checkout form ──────────────────────────────────────
    // Navigate to a product and add it to the cart first
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/checkout`)

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

    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()
    await page.waitForURL('**/confirmation')

    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

testSearchAndCheckout().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

The loop over `fieldMap` is a concise pattern for filling many fields: you define the data separately from the fill logic, which makes the test data easy to swap out for different scenarios later.

Note that the test navigates to the product page and clicks "Add to Cart" before going to checkout. The app requires items in the cart for the checkout page to render the form — if the cart is empty, it shows an empty-cart message instead.
