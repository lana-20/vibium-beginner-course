const AUT = 'https://automation-exercise.daisyladybug.com'

export class ProductsPage {
  constructor(private page: any) {}

  async goto() {
    await this.page.go(`${AUT}/products`)
  }

  async search(query: string) {
    const input = await this.page.find("input[placeholder='Search products...']")
    await input.fill(query)
  }

  async filterByCategory(category: string) {
    const select = await this.page.find('select:first-of-type')
    await select.selectOption(category)
  }

  async sortBy(option: string) {
    const select = await this.page.find('select:last-of-type')
    await select.selectOption(option)
  }

  async productCount() {
    const items = await this.page.findAll('a[href*="/products/prod_"]')
    return items.length
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
