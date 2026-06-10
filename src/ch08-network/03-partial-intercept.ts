import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testPartialIntercept() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/*', async (route: any) => {
      if (route.request().url().includes('/api/products')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.continue()
      }
    })

    await page.go(`${AUT}/products`)

    const count = await page.count('a[href*="/products/prod_"]')
    assert.equal(count, 0, 'empty product list from stub')

    // page itself still loaded (scripts/styles passed through)
    const nav = await page.find({ role: 'navigation' })
    assert.ok(await nav.isVisible(), 'nav still rendered')

    console.log('Partial intercept assertions passed.')
  } finally {
    await browser.close()
  }
}

testPartialIntercept().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
