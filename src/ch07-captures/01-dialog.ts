import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'

async function testDialogCapture() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.setContent(`
      <button id="alert-btn" onclick="alert('Hello from alert!')">Show Alert</button>
      <button id="confirm-btn" onclick="
        const ok = confirm('Delete this item?');
        document.getElementById('result').textContent = ok ? 'confirmed' : 'cancelled';
      ">Show Confirm</button>
      <div id="result"></div>
    `)

    const [alertResult] = await Promise.all([
      page.capture.dialog('accept'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Alert' })
        btn.click()
      })(),
    ])
    assert.equal(alertResult.type, 'alert')
    assert.equal(alertResult.message, 'Hello from alert!')
    console.log('Alert captured:', alertResult.message)

    await Promise.all([
      page.capture.dialog('accept'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Confirm' })
        btn.click()
      })(),
    ])
    await page.waitForText('confirmed')
    assert.ok(
      await (await page.find({ text: 'confirmed' })).isVisible(),
      'confirm accepted'
    )

    await page.evaluate("document.getElementById('result').textContent = ''")

    await Promise.all([
      page.capture.dialog('dismiss'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Confirm' })
        btn.click()
      })(),
    ])
    await page.waitForText('cancelled')
    assert.ok(
      await (await page.find({ text: 'cancelled' })).isVisible(),
      'confirm dismissed'
    )

    console.log('Dialog capture assertions passed.')
  } finally {
    await browser.close()
  }
}

testDialogCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
