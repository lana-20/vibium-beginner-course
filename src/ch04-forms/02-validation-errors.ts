import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Add an item to cart so the checkout form renders
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/checkout`)

    // Submit empty form — validation errors should appear
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
    ]

    for (const message of errors) {
      const el = await page.find({ text: message })
      assert.ok(await el.isVisible(), `error visible: ${message}`)
    }

    console.log(`✓ ${errors.length} validation errors shown on empty submit`)
    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
