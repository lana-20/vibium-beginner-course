const AUT = 'https://automation-exercise.daisyladybug.com'

export class ProductsPage {
  constructor(private page: any) {}

  async goto() {
    await this.page.go(`${AUT}/products`)
  }

  async search(query: string) {
    const input = await this.page.find({ css: "input[placeholder='Search products...']" })
    await input.fill(query)
  }

  async filterByCategory(category: string) {
    const select = await this.page.find({ css: 'select:first-of-type' })
    await select.select(category)
  }

  async sortBy(option: string) {
    const select = await this.page.find({ css: 'select:last-of-type' })
    await select.select(option)
  }

  async productCount() {
    return this.page.count('a[href*="/products/prod_"]')
  }

  async isProductVisible(name: string) {
    try {
      const el = await this.page.find({ text: name })
      return el.isVisible()
    } catch {
      return false
    }
  }

  async clickProduct(name: string) {
    const el = await this.page.find({ role: 'link', text: name })
    await el.click()
  }
}
