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
    console.log('✓ search filter')

    const category = await page.find({ css: 'select:first-of-type' })
    await category.select('Electronics')
    assert.ok(
      await (await page.find({ text: 'Electronics' })).isVisible(),
      'Electronics filter active'
    )
    console.log('✓ category filter')

    // ── Add to cart ────────────────────────────────────────
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    // ── Checkout form ──────────────────────────────────────
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
    console.log('✓ form filled')

    const submit = await page.find({ role: 'button', text: 'Place Order' })
    await submit.click()
    await page.waitForURL('**/confirmation')
    console.log('✓ order placed — reached confirmation page')

    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

testSearchAndCheckout().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
