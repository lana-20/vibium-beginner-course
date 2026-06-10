const AUT = 'https://automation-exercise.daisyladybug.com'

export class CartPage {
  constructor(private page: any) {}

  async goto() {
    await this.page.go(`${AUT}/cart`)
  }

  async itemCount() {
    const el = await this.page.find({ css: '.cart-summary, [class*="summary"]' })
    return el.text()
  }

  async subtotal() {
    const el = await this.page.find({ text: 'Subtotal' })
    const row = await this.page.find({ css: '[data-testid="subtotal-value"]' })
    return row.text()
  }

  async increaseQuantity(productName: string) {
    const btn = await this.page.find({ role: 'button', text: `Increase ${productName} quantity` })
    await btn.click()
  }

  async decreaseQuantity(productName: string) {
    const btn = await this.page.find({ role: 'button', text: `Decrease ${productName} quantity` })
    await btn.click()
  }

  async proceedToCheckout() {
    const btn = await this.page.find({ role: 'link', text: 'Proceed to Checkout' })
    await btn.click()
  }
}
