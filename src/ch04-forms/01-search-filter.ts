import vibium from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)

    // fill text search
    const search = await page.find({ css: "input[placeholder='Search products...']" })
    await search.fill('headphones')

    const result = await page.find({ text: 'Wireless Headphones' })
    assert.ok(await result.isVisible(), 'search result visible')
    console.log('✓ search filter works')

    // select category dropdown
    const category = await page.find({ css: 'select:first-of-type' })
    await category.select('Electronics')

    const label = await page.find({ text: 'Electronics' })
    assert.ok(await label.isVisible(), 'Electronics filter active')
    console.log('✓ category filter works')

    // select sort dropdown
    const sort = await page.find({ css: 'select:last-of-type' })
    await sort.select('Price: Low to High')
    console.log('✓ sort applied')

    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
