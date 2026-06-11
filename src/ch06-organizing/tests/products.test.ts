import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'
import { ProductsPage } from '../pages/ProductsPage'
import { CartPage } from '../pages/CartPage'

const AUT = 'https://automation-exercise.daisyladybug.com'

describe('Products page', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let context: any
  let page: any

  beforeAll(async () => {
    browser = await vibium.start({ headless: process.env.CI === 'true' })
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

  it('shows 12 products by default', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    expect(await products.productCount()).toBe(12)
  })

  it('filters to Electronics category', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.filterByCategory('Electronics')
    await page.find({ text: 'Showing 3 of 12 products' })
    expect(await products.isProductVisible('Wireless Headphones')).toBe(true)
    expect(await products.isProductVisible('Blue Cotton T-Shirt')).toBe(false)
  })

  it('search finds a product by name', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.search('yoga')
    expect(await products.isProductVisible('Yoga Mat')).toBe(true)
    expect(await products.isProductVisible('Wireless Headphones')).toBe(false)
  })

  it('navigates to product detail on click', async () => {
    const products = new ProductsPage(page)
    await products.goto()
    await products.clickProduct('Wireless Headphones')
    await page._waitForURL('**/products/prod_001')
    expect((await page.url()).includes('/products/prod_001')).toBe(true)
  })

  it('adds a product to cart', async () => {
    await page.go(`${AUT}/products/prod_001`)
    const addBtn = await page.find({ role: 'button', text: 'Add to Cart' })
    await addBtn.click()
    await page.find({ text: '1' }, { timeout: 5000 })  // wait for cart badge

    const cart = new CartPage(page)
    await cart.goto()
    await page.find({ text: '1 item · 1 product' })
    expect(await (await page.find({ text: '1 item · 1 product' })).isVisible()).toBe(true)
  })
})
