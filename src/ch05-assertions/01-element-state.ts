import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testElementState() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products/prod_001`)

    const price = await page.find({ text: '$79.99' })
    assert.ok(await price.isVisible(), 'price visible')

    const addToCart = await page.find({ role: 'button', text: 'Add to Cart' })
    assert.ok(await addToCart.isEnabled(), 'Add to Cart enabled')

    const heading = await page.find({ role: 'heading', text: 'Wireless Headphones' })
    const headingText = await heading.text()
    assert.ok(headingText.includes('Wireless Headphones'), 'heading text matches')

    const link = await page.find({ role: 'link', text: 'Products' })
    const href = await link.attr('href')
    assert.ok(href?.includes('/products'), 'nav link href contains /products')

    console.log('Element state assertions passed.')
  } finally {
    await browser.close()
  }
}

testElementState().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
