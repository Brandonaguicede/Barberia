import fs from 'node:fs/promises'
import { chromium } from 'playwright'

// Rasterize the supplied vector brand symbol for installable PWA icons.
// Use ICON_BROWSER to select an existing Chromium when Playwright is not installed.
const svg = await fs.readFile('public/icons/tenorio.svg', 'utf8')
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ICON_BROWSER ? { executablePath: process.env.ICON_BROWSER } : {}),
})
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;background:#10151d}img{display:block;width:100vw;height:100vh}</style><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`)
    await page.locator('img').evaluate(image => image.decode())
    await page.screenshot({ path: `public/icons/icon-${size}.png` })
  }
} finally {
  await browser.close()
}
