import { browser as vibium } from 'vibium'

export const AUT = process.env.AUT_BASE_URL || 'https://automation-exercise.daisyladybug.com'

export async function startBrowser() {
  const headless = process.env.CI === 'true'
  return vibium.start({ headless })
}
