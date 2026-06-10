import vibium from 'vibium'

const AUT = 'https://automation-exercise.daisyladybug.com/'

async function main() {
  const browser = await vibium.start({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.go(AUT)

  const heading = await page.find({ text: 'Featured Products' })
  console.log('heading text:', await heading.text())

  await browser.close()
}

main()
