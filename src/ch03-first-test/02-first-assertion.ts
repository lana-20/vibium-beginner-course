import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)

    const title = await page.title()
    assert.equal(title, 'automation-exercise | E-commerce Testing Sandbox')
    console.log('✓ page title correct')

    const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
    assert.ok(await heading.isVisible())
    console.log('✓ hero heading visible')

    const featured = await page.find({ role: 'heading', text: 'Featured Products' })
    assert.ok(await featured.isVisible())
    console.log('✓ Featured Products section visible')

  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('Assertion failed:', err.message)
  process.exit(1)
})
