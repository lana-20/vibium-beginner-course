import vibium from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.go(AUT)

  const title = await page.title()
  console.log('title:', title)
  // "automation-exercise | E-commerce Testing Sandbox"

  const heading = await page.find({ role: 'heading', text: 'automation-exercise' })
  console.log('heading:', await heading.text())

  const featured = await page.find({ role: 'heading', text: 'Featured Products' })
  console.log('featured section:', await featured.text())

  await browser.close()
}

main()
