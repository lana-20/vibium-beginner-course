import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testCartTotals() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products/prod_001`)
    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    await addToCart.click()

    await page.go(`${AUT}/cart`)

    assert.ok(
      await (await page.find({ text: '1 ITEM · 1 PRODUCT' })).isVisible(),
      'cart shows 1 item'
    )
    assert.ok(
      await (await page.find({ text: '$79.99' })).isVisible(),
      'unit price visible'
    )

    const increase = await page.find({ role: 'button', text: 'Increase Wireless Headphones quantity' })
    await increase.click()

    await page.waitForText('2 ITEMS · 1 PRODUCT')
    await page.waitForText('$159.98')

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
