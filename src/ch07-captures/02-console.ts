import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

async function testConsoleCapture() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.setContent(`
      <button onclick="
        console.log('item added');
        console.warn('stock low: 1 remaining');
        console.error('this should not appear');
      ">Add Item</button>
    `)

    const [messages] = await Promise.all([
      page.capture.console(),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Add Item' })
        btn.click()
      })(),
    ])

    const logMessages = messages.filter((m: any) => m.type === 'log')
    const warnMessages = messages.filter((m: any) => m.type === 'warning')
    const errorMessages = messages.filter((m: any) => m.type === 'error')

    assert.equal(logMessages.length, 1, 'one log message')
    assert.equal(logMessages[0].text, 'item added')
    assert.equal(warnMessages.length, 1, 'one warning')
    assert.ok(warnMessages[0].text.includes('stock low'), 'warning text correct')
    assert.equal(errorMessages.length, 1, 'one error message captured')

    console.log('Console capture assertions passed.')
    console.log('Captured messages:', messages.map((m: any) => `[${m.type}] ${m.text}`))
  } finally {
    await browser.close()
  }
}

testConsoleCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
