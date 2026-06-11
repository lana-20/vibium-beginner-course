import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { browser as vibium } from 'vibium'
import { ProductsPage } from '../pages/ProductsPage'
import { CartPage } from '../pages/CartPage'

const AUT = 'https://automation-exercise.daisyladybug.com'

describe('Products page', () => {
  let browser: Awaited<ReturnType<typeof vibium.start>>
  let page: any

  beforeEach(async () => {
    browser = await vibium.start({ headless: true })
    const context = await browser.newContext()
    page = await context.newPage()
  })

  afterEach(async () => {
    await browser.stop()
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
    await page.find({ text: 'SHOWING 3 OF 12 PRODUCTS' })
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

    const cart = new CartPage(page)
    await cart.goto()
    await page.find({ text: '1 ITEM · 1 PRODUCT' })
    expect(await (await page.find({ text: '1 ITEM · 1 PRODUCT' })).isVisible()).toBe(true)
  })
})
