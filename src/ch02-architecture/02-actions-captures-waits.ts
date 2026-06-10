import { browser as vibium } from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  // action: navigate
  await page.go(AUT)

  // action: click
  const firstProduct = await page.find({ role: 'link', text: 'View Product' })
  await firstProduct.click()

  // wait: URL changes after navigation
  await page.waitForURL('**/product_details/**')

  // action: add to cart triggers a modal/dialog
  const addToCart = await page.find({ role: 'button', text: 'Add to cart' })
  await addToCart.click()

  // wait: confirmation text appears
  await page.waitForText('Added!')

  await browser.close()
}

main()
