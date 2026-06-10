import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'

const AUT = process.env.AUT_BASE_URL ?? 'https://automation-exercise.daisyladybug.com'
const headless = process.env.CI === 'true'

describe('Smoke tests (CI-ready)', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let page: any

  beforeEach(async () => {
    browser = await vibium.start({ headless })
    const context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await browser.close()
  })

  it('homepage loads and shows hero', async () => {
    await page.go(AUT)
    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    expect(await hero.isVisible()).toBe(true)
  })

  it('products page shows 12 products', async () => {
    await page.go(`${AUT}/products`)
    const count = await page.count('a[href*="/products/prod_"]')
    expect(count).toBe(12)
  })

  it('product detail page loads', async () => {
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    expect(await addBtn.isEnabled()).toBe(true)
  })
})
