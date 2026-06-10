import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function testHomepage() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)

    assert.equal(
      await page.title(),
      'automation-exercise | E-commerce Testing Sandbox',
      'page title'
    )

    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    assert.ok(await hero.isVisible(), 'hero heading visible')

    const featured = await page.find({ role: 'heading', text: 'Featured Products' })
    assert.ok(await featured.isVisible(), 'Featured Products section visible')

    const product = await page.find({ text: 'Wireless Headphones Pro' })
    assert.ok(await product.isVisible(), 'first featured product visible')

    const cta = await page.find({ role: 'link', text: 'Explore Products' })
    assert.ok(await cta.isVisible(), 'Explore Products CTA visible')

    console.log('All assertions passed.')
  } finally {
    await browser.close()
  }
}

testHomepage().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
