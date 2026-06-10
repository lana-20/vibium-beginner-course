import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testWaits() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)

    const category = await page.find({ css: 'select:first-of-type' })
    await category.select('Electronics')

    // wait for the count label to update before asserting
    await page.waitForText('SHOWING 3 OF 12 PRODUCTS')

    const label = await page.find({ text: 'SHOWING 3 OF 12 PRODUCTS' })
    assert.ok(await label.isVisible(), 'filter label updated')

    assert.ok(
      await (await page.find({ text: 'Wireless Headphones' })).isVisible(),
      'Wireless Headphones visible'
    )
    assert.ok(
      await (await page.find({ text: 'USB-C Cable 6ft' })).isVisible(),
      'USB-C Cable visible'
    )
    assert.ok(
      await (await page.find({ text: 'Laptop Stand' })).isVisible(),
      'Laptop Stand visible'
    )

    // navigate to product and wait for URL
    const headphones = await page.find({ role: 'link', text: 'Wireless Headphones' })
    await headphones.click()
    await page.waitForURL('**/products/prod_001')

    assert.ok(
      (await page.url()).includes('/products/prod_001'),
      'URL updated to product detail page'
    )

    console.log('Wait assertions passed.')
  } finally {
    await browser.close()
  }
}

testWaits().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
