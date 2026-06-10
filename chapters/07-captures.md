# Chapter 7: Capturing Events

So far we've controlled the browser: navigate, click, fill, assert. In this chapter we flip the direction — instead of sending actions to the browser, we *listen* for events the browser sends to us. Vibium provides three capture primitives: `capture.dialog()`, `capture.console()`, and `capture.download()`.

---

## 7.1 The Capture Pattern

All three captures share the same API shape. You set up a listener *before* the action that triggers the event, then trigger the action:

```typescript
const [dialogResult] = await Promise.all([
  capture.dialog('accept'),   // 1. set up listener first
  button.click(),             // 2. trigger the event
])
```

The `Promise.all` is critical. If you `await capture.dialog()` first and *then* click, you deadlock: the capture is waiting for a dialog, the dialog is waiting for your click, and nothing moves. With `Promise.all`, both sides start concurrently.

The inner function inside `capture.dialog` — if it fires a click — must fire-and-forget (not awaited). See section 7.2.

---

## 7.2 Capturing Dialogs

`capture.dialog(action)` intercepts the next native browser dialog (alert, confirm, prompt) and handles it automatically. The action is either `'accept'` or `'dismiss'`.

Since our AUT (automation-exercise.daisyladybug.com) uses React-rendered UI and doesn't trigger native browser dialogs, we create a minimal inline page to demonstrate the pattern:

```typescript
import vibium from 'vibium'
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

    // --- alert ---
    const [alertResult] = await Promise.all([
      page.capture.dialog('accept'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Alert' })
        btn.click()  // fire-and-forget: don't await inside capture.dialog
      })(),
    ])
    assert.equal(alertResult.type, 'alert')
    assert.equal(alertResult.message, 'Hello from alert!')

    // --- confirm: accept ---
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

    // --- confirm: dismiss ---
    await page.find({ css: '#result' })
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
```

---

## 7.3 Capturing Console Messages

`capture.console()` collects console output emitted during a block of actions. Useful when verifying that app code logs the right messages (or doesn't log errors):

```typescript
import vibium from 'vibium'
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

    assert.equal(logMessages[0].text, 'item added')
    assert.ok(warnMessages[0].text.includes('stock low'))

    console.log('Console capture assertions passed.')
  } finally {
    await browser.close()
  }
}

testConsoleCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

---

## 7.4 Capturing Downloads

`capture.download()` intercepts a file download triggered by a link or button click. You provide a directory to save the file:

```typescript
import vibium from 'vibium'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

async function testDownloadCapture() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  const downloadDir = '/tmp/vibium-downloads'
  fs.mkdirSync(downloadDir, { recursive: true })

  try {
    await page.setContent(`
      <a href="data:text/csv;charset=utf-8,id%2Cname%0A1%2CWireless%20Headphones"
         download="products.csv">Download CSV</a>
    `)

    const [download] = await Promise.all([
      page.capture.download(downloadDir),
      (async () => {
        const link = await page.find({ role: 'link', text: 'Download CSV' })
        link.click()
      })(),
    ])

    assert.equal(download.suggestedFilename, 'products.csv')
    assert.ok(
      fs.existsSync(path.join(downloadDir, download.suggestedFilename)),
      'file saved to disk'
    )

    console.log('Download capture assertions passed.')
  } finally {
    await browser.close()
  }
}

testDownloadCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

The `Promise.all` pattern is identical to dialogs. The click fires, the browser triggers the download, `capture.download()` intercepts it and saves it, then returns a download descriptor with `suggestedFilename` and the path where it was saved.

---

## 7.5 Why fire-and-forget inside capture.dialog?

When you write:

```typescript
Promise.all([
  capture.dialog('accept'),
  (async () => {
    btn.click()   // no await
  })(),
])
```

The `btn.click()` is intentionally not awaited. Vibium's `click()` doesn't return until the browser acknowledges the click *and* any resulting navigation settles. But a dialog blocks the browser from settling. So `await click()` would hang waiting for the browser, and `capture.dialog()` would wait for the dialog, creating a deadlock. Firing the click without awaiting lets the dialog appear, the capture handles it, and then the whole `Promise.all` resolves.
