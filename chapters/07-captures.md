# Chapter 7: Capturing Events

Every chapter so far has been about sending commands to the browser: navigate here, click this, fill that. In this chapter we flip the direction. Instead of telling the browser what to do, we *listen* for events the browser fires at us. Vibium calls these captures, and there are three of them: `capture.dialog()` intercepts native browser dialogs, `capture.console()` collects console output, and `capture.download()` intercepts file downloads.

Captures are one of the trickier concepts in Vibium, because they require a different timing pattern than everything else we've done. Let me explain that pattern clearly before we write any code.

---

## The capture pattern: why Promise.all matters

When you use any capture, you have to set up the listener *before* the action that triggers the event. That's the key rule. If you set up the listener after, you miss the event.

Here's the natural but incorrect approach:

```typescript
// WRONG: this deadlocks
await page.capture.dialog('accept')  // waits for a dialog
await button.click()                  // dialog fires here... but nobody receives it
```

If you await the capture first, it blocks, waiting for a dialog. The dialog won't come until the button is clicked. But you haven't clicked the button yet. You've deadlocked.

The correct pattern is `Promise.all`:

```typescript
// CORRECT: both start at the same time
await Promise.all([
  page.capture.dialog('accept'),   // starts listening
  (async () => {
    const btn = await page.find({ role: 'button', text: 'Delete' })
    btn.click()                    // triggers the dialog — fire-and-forget, no await
  })(),
])
```

`Promise.all` starts both sides concurrently. The capture is listening when the button fires the dialog, so the event is caught. Notice that `btn.click()` is *not* awaited. That's intentional and important: Vibium's `click()` doesn't return until any resulting navigation settles. But a dialog blocks settlement. If you await the click, it waits for the browser to settle; the browser waits for the dialog to be handled; you've deadlocked again from the other side. Fire the click without awaiting — let the dialog appear, let the capture handle it, then the whole `Promise.all` resolves.

This fire-and-forget pattern for click inside a capture is a rule. It applies to all three capture types.

---

## Capturing dialogs

`page.capture.dialog(action)` intercepts the next native browser dialog — alert, confirm, or prompt — and handles it automatically. The action is `'accept'` or `'dismiss'`. The result tells you the dialog's type and message.

Our app at automation-exercise uses React for all its modals, so native browser dialogs don't appear there. We'll use `page.setContent()` to inject a minimal HTML page that triggers real native dialogs:

```typescript
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

    // Capture the alert
    const [alertResult] = await Promise.all([
      page.capture.dialog('accept'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Alert' })
        btn.click()  // fire-and-forget
      })(),
    ])

    assert.equal(alertResult.type, 'alert', 'dialog type is alert')
    assert.equal(alertResult.message, 'Hello from alert!', 'alert message')
    console.log('✓ alert captured')

    // Capture the confirm dialog and accept it
    await Promise.all([
      page.capture.dialog('accept'),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Show Confirm' })
        btn.click()
      })(),
    ])

    await page.find({ text: 'confirmed' })
    assert.ok(
      await (await page.find({ text: 'confirmed' })).isVisible(),
      'confirm was accepted'
    )
    console.log('✓ confirm accepted')

    console.log('All dialog assertions passed.')
  } finally {
    await browser.stop()
  }
}

testDialogCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

After the first capture, `alertResult` has a `type` property (`'alert'`, `'confirm'`, or `'prompt'`) and a `message` property with the text the dialog showed. After the second capture, we use `page.find({ text: 'confirmed' })` to confirm the DOM updated to "confirmed" — meaning the app correctly received the dialog's outcome.

---

## Capturing console messages

`page.capture.console()` collects all console output emitted during a block of browser actions. This is useful for verifying that your app logs the right messages in response to user actions — or, just as importantly, that it *doesn't* log errors it shouldn't.

```typescript
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
      ">Add Item</button>
    `)

    const [messages] = await Promise.all([
      page.capture.console(),
      (async () => {
        const btn = await page.find({ role: 'button', text: 'Add Item' })
        btn.click()
      })(),
    ])

    const logs  = messages.filter((m: any) => m.type === 'log')
    const warns = messages.filter((m: any) => m.type === 'warning')

    assert.equal(logs[0].text, 'item added', 'log message matches')
    assert.ok(warns[0].text.includes('stock low'), 'warning contains expected text')

    console.log('Console capture assertions passed.')
  } finally {
    await browser.stop()
  }
}

testConsoleCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

Each message in the returned array has a `type` (matching the console method used: `'log'`, `'warning'`, `'error'`, `'info'`) and a `text` property. You can filter by type and assert on specific messages. This is particularly useful when you suspect an error is being silently swallowed — add a console capture and assert there are no messages of type `'error'`.

---

## Capturing downloads

`page.capture.download()` intercepts a file download triggered by a link or button click. You pass a directory where the file should be saved. The result gives you the filename and the saved path.

```typescript
import { browser as vibium } from 'vibium'
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

    assert.equal(download.suggestedFilename, 'products.csv', 'correct filename')
    assert.ok(
      fs.existsSync(path.join(downloadDir, download.suggestedFilename)),
      'file saved to disk'
    )
    console.log('Download capture assertions passed.')
  } finally {
    await browser.stop()
  }
}

testDownloadCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
```

The pattern is identical to dialogs and console — `Promise.all`, fire-and-forget click inside. The download descriptor has `suggestedFilename` (the name the browser assigned) and the full path to the saved file. You can also read the file content from disk to verify its structure.

---

## Quick reference: all three captures

Here's the shape of each one side by side:

```typescript
// Dialog — intercept and handle
const [result] = await Promise.all([
  page.capture.dialog('accept'),  // or 'dismiss'
  (async () => { trigger.click() })(),
])
// result.type, result.message

// Console — collect messages
const [messages] = await Promise.all([
  page.capture.console(),
  (async () => { trigger.click() })(),
])
// messages[].type, messages[].text

// Download — save file
const [download] = await Promise.all([
  page.capture.download('/tmp/downloads'),
  (async () => { trigger.click() })(),
])
// download.suggestedFilename, download.path
```

One mental model for remembering the rule: captures are *subscriptions*. You subscribe to an event channel before the event fires. If you subscribe after the event, you've already missed it. `Promise.all` is the mechanism that lets you subscribe and fire at the same time.

In the next chapter we go one level deeper — intercepting HTTP requests before they reach the server, returning synthetic data, and simulating error conditions. Network interception is how you write tests that are fast, reliable, and don't depend on external services being available.

---

## Exercise

Write three separate test functions, one for each capture type. Each test should use `Promise.all` with a fire-and-forget click inside the second argument.

**Test 1: `testDeleteConfirmation`**
- Navigate to the cart page (add a product first if needed)
- Use `page.capture.dialog('dismiss')` to cancel a delete confirmation
- Click a "Remove" or "Delete" button that triggers an alert
- Assert that `result.type === 'confirm'` (or `'alert'`)
- Assert that the item is still in the cart after dismissing

**Test 2: `testConsoleErrors`**
- Navigate to a page
- Use `page.capture.console()` to collect messages during a page interaction
- Perform any interaction that might log to the console
- Assert that `messages` is an array (even if empty)

**Test 3: `testDownload`**
- Navigate to a page that has a CSV download link
- Use `page.capture.download('/tmp/vibium-downloads')` to intercept the download
- Click the download trigger
- Assert `download.suggestedFilename` ends with `'.csv'`

---

## Quiz

**1.** Why must the click inside a `Promise.all` capture be fire-and-forget (no `await` on the click)?

- A. `await` inside `Promise.all` is a syntax error
- B. Awaiting the click would block until the dialog is handled, creating a deadlock — the capture promise can't resolve because the click never completes
- C. Fire-and-forget clicks run faster than awaited clicks
- D. The Vibium API requires it for dialog captures only

**2.** `page.capture.dialog('accept')` vs `page.capture.dialog('dismiss')` — what is the difference?

- A. `accept` clicks OK; `dismiss` clicks Cancel or closes the dialog
- B. `accept` intercepts only alerts; `dismiss` intercepts only confirms
- C. They are identical — both close the dialog
- D. `dismiss` is for file dialogs; `accept` is for browser alerts

**3.** The `result` from `page.capture.dialog()` contains:

- A. The HTML of the page after the dialog closed
- B. The button text that was clicked
- C. The dialog type and message text
- D. Whether the user accepted or dismissed

**4.** Console captures collect:

- A. Only `console.error` calls
- B. Only `console.log` calls from your test code
- C. All browser console messages — log, warn, error, info — that fire while the capture is active
- D. Only messages that occur before the trigger click

**5.** What does `download.suggestedFilename` contain?

- A. The full path to the file on disk
- B. The MIME type of the downloaded file
- C. The filename the browser assigned to the download, as it would appear in the download bar
- D. The URL of the file that was downloaded

**Answers:** 1-B, 2-A, 3-C, 4-C, 5-C

---

## Solution

```typescript
import { browser as vibium } from 'vibium'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'

const AUT = 'https://automation-exercise.daisyladybug.com'

async function testDeleteConfirmation() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Add a product to cart first
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    await addBtn.click()
    await page.go(`${AUT}/cart`)

    const removeBtn = await page.find({ role: 'button', text: 'Remove' })

    const [result] = await Promise.all([
      page.capture.dialog('dismiss'),
      (async () => { removeBtn.click() })(),
    ])

    assert.ok(
      result.type === 'confirm' || result.type === 'alert',
      `dialog type is confirm or alert (got: ${result.type})`
    )

    // Item should still be in cart after dismissing
    const item = await page.find({ text: 'Wireless Headphones' })
    assert.ok(await item.isVisible(), 'item still in cart after dismiss')

    console.log('testDeleteConfirmation passed.')
  } finally {
    await browser.stop()
  }
}

async function testConsoleErrors() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const [messages] = await Promise.all([
      page.capture.console(),
      (async () => {
        await page.go(`${AUT}/products`)
        const search = await page.find("input[placeholder='Search products...']")
        search.fill('test')
      })(),
    ])

    assert.ok(Array.isArray(messages), 'messages is an array')
    console.log(`testConsoleErrors passed. ${messages.length} console message(s) captured.`)
  } finally {
    await browser.stop()
  }
}

async function testDownload() {
  const downloadDir = '/tmp/vibium-downloads'
  fs.mkdirSync(downloadDir, { recursive: true })

  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(AUT)
    // Find a download link — adjust selector to match a link in the app
    const downloadLink = await page.find({ role: 'link', text: 'Download CSV' })

    const [download] = await Promise.all([
      page.capture.download(downloadDir),
      (async () => { downloadLink.click() })(),
    ])

    assert.ok(download.suggestedFilename.endsWith('.csv'), 'filename ends with .csv')
    console.log('testDownload passed:', download.suggestedFilename)
  } finally {
    await browser.stop()
  }
}

testDeleteConfirmation().catch(err => { console.error(err.message); process.exit(1) })
```

> **Note:** The dialog test assumes there is a "Remove" button in the cart that triggers a browser confirm dialog. The download test requires a page with a "Download CSV" link — check the app for the correct trigger element. The console capture test always passes since it only asserts the return type.
