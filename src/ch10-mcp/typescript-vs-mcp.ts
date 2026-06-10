/**
 * Chapter 10 — TypeScript client side of the CLI/MCP comparison.
 *
 * This script performs the same scenario you would describe to an MCP agent
 * in a single natural-language prompt:
 *   "Go to the products page, filter by Electronics, and tell me
 *    how many products appear and what their names are."
 *
 * Run:  npx tsx src/ch10-mcp/typescript-vs-mcp.ts
 */
import { browser as vibium } from 'vibium'

const AUT = process.env.AUT_BASE_URL ?? 'https://automation-exercise.daisyladybug.com'

async function electronicsSurvey() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.go(`${AUT}/products`)

    const select = await page.find({ css: 'select:first-of-type' })
    await select.select('Electronics')
    await page.waitForText('SHOWING 3 OF 12 PRODUCTS')

    const count = await page.count('a[href*="/products/prod_"]')
    console.log(`Products shown: ${count}`)

    const names = ['Wireless Headphones', 'USB-C Cable 6ft', 'Laptop Stand']
    for (const name of names) {
      const el = await page.find({ text: name })
      const visible = await el.isVisible()
      console.log(`  ${visible ? '✓' : '✗'} ${name}`)
    }
  } finally {
    await browser.close()
  }
}

electronicsSurvey().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})
