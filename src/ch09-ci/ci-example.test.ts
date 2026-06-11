import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'

const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'
const headless = process.env.CI === 'true'

describe('Smoke tests (CI-ready)', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let context: any
  let page: any

  beforeAll(async () => {
    browser = await vibium.start({ headless })
  })

  afterAll(async () => {
    await browser.stop()
  })

  beforeEach(async () => {
    context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await context.close()
  })

  it('homepage loads and shows hero', async () => {
    await page.go(AUT)
    const hero = await page.find({ role: 'heading', text: 'automation-exercise' })
    expect(await hero.isVisible()).toBe(true)
  })

  it('products page shows 12 products', async () => {
    await page.go(`${AUT}/products`)
    const items = await page.findAll('a[href*="/products/prod_"]')
    expect(items.length).toBe(12)
  })

  it('product detail page loads', async () => {
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    expect(await addBtn.isEnabled()).toBe(true)
  })
})
