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
      <a href="data:text/csv;charset=utf-8,id%2Cname%2Cprice%0A1%2CWireless%20Headphones%2C79.99"
         download="products.csv">Download CSV</a>
    `)

    const [download] = await Promise.all([
      page.capture.download(downloadDir),
      (async () => {
        const link = await page.find({ role: 'link', text: 'Download CSV' })
        link.click()
      })(),
    ])

    assert.equal(download.suggestedFilename, 'products.csv', 'filename correct')
    const savedPath = path.join(downloadDir, download.suggestedFilename)
    assert.ok(fs.existsSync(savedPath), 'file saved to disk')

    const content = fs.readFileSync(savedPath, 'utf8')
    assert.ok(content.includes('Wireless Headphones'), 'CSV contains expected data')

    console.log('Download capture assertions passed.')
    console.log('Saved to:', savedPath)
  } finally {
    await browser.close()
  }
}

testDownloadCapture().catch(err => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
