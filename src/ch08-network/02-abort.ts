import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testNetworkAbort() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.route('**/api/products*', async (route: any) => {
      await route.abort()
    })

    await page.go(`${AUT}/products`)

    const body = await page.find({ css: 'body' })
    const text = await body.text()
    assert.ok(text.length > 0, 'page rendered despite API failure')

    console.log('Network abort test complete — app state:', text.slice(0, 100))
  } finally {
    await browser.close()
  }
}

testNetworkAbort().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
