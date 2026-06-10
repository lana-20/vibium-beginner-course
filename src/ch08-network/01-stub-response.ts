import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testStubProductList() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/api/products*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'prod_001', name: 'Wireless Headphones', price: 79.99, category: 'Electronics', rating: 4.5, inStock: true, stockCount: 15 },
          { id: 'prod_007', name: 'Coffee Maker', price: 49.99, category: 'Home', rating: 4.2, inStock: true, stockCount: 8 },
        ]),
      })
    })

    await page.go(`${AUT}/products`)

    const count = await page.count('a[href*="/products/prod_"]')
    assert.equal(count, 2, 'stubbed response shows exactly 2 products')

    assert.ok(
      await (await page.find({ text: 'Wireless Headphones' })).isVisible(),
      'first stubbed product visible'
    )
    assert.ok(
      await (await page.find({ text: 'Coffee Maker' })).isVisible(),
      'second stubbed product visible'
    )

    console.log('Stub response assertions passed.')
  } finally {
    await browser.close()
  }
}

testStubProductList().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
