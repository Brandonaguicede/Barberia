import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

test('selector de servicios: buscar, filtrar, teclado y panel móvil accesible', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const services = [
    { id: 'clasico', name: 'Corte clásico', description: 'Un acabado limpio y preciso, a tu estilo.', category: 'corte', duration: 30, price: 4000, active: true },
    { id: 'navaja', name: 'Corte a navaja', description: 'Textura y definición en cada detalle.', category: 'corte', duration: 45, price: 5000, active: true },
    { id: 'barba', name: 'Perfilado de barba', description: 'Líneas definidas y un acabado natural.', category: 'barba', duration: 20, price: 3000, active: true },
    { id: 'combo', name: 'Corte + barba', description: 'Tu look completo en una sola visita.', category: 'combo', duration: 60, price: 7000, active: true },
  ]
  try {
    await fs.mkdir('.npm-cache/screenshots', { recursive: true })
    for (const [device, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }], ['small', { width: 320, height: 640 }]]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      page.on('pageerror', e => errors.push(e.message))
      await context.route('**/rest/v1/catalog_revision*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision: 1 }) }))
      await context.route('**/functions/v1/booking', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        services, barbers: [{ id: 'axel', name: 'Axel', active: true }], barber_services: services.map(s => ({ service_id: s.id, barber_id: 'axel' })), settings: { shop_name: 'TENORIO BARBER', horizon_days: 90 },
      }) }))
      await page.goto(process.env.SMOKE_URL || 'http://localhost:5173')
      const trigger = page.getByRole('button', { name: 'Servicio', exact: true })
      const dialog = page.getByRole('dialog', { name: 'Elige tu servicio', exact: true })
      await trigger.click()
      await dialog.waitFor()
      const search = dialog.getByRole('combobox', { name: 'Buscar servicio' })
      assert.equal(await dialog.getByRole('option').count(), 4)
      assert.equal(await page.locator('select#booking-service').count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `.npm-cache/screenshots/service-picker-${device}.png`, fullPage: true, animations: 'disabled' })
      if (device !== 'desktop') {
        assert.equal(await dialog.getAttribute('aria-modal'), 'true')
        assert.equal(await page.evaluate(() => document.getElementById('root').inert), true)
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
        // Opening by touch leaves the virtual keyboard closed until the client searches.
        assert.equal(await search.evaluate(el => document.activeElement === el), false)
        await dialog.focus(); await page.keyboard.press('Shift+Tab')
        assert.equal(await dialog.getByRole('button', { name: 'Combos', exact: true }).evaluate(el => document.activeElement === el), true)
        await page.keyboard.press('Tab')
        assert.equal(await dialog.getByRole('button', { name: 'Cerrar selector de servicios' }).evaluate(el => document.activeElement === el), true)
      }
      await search.fill('clasico')
      assert.equal(await dialog.getByRole('option').count(), 1)
      await search.press('Enter')
      await dialog.waitFor({ state: 'hidden' })
      await page.waitForFunction(() => document.activeElement?.id === 'booking-service')
      assert.equal(await trigger.getAttribute('data-selected-service'), 'clasico')
      assert.match((await trigger.textContent()).replace(/\s/g, ''), /4000/)
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true)
      assert.equal(await page.evaluate(() => document.getElementById('root').inert), false)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await trigger.press('ArrowDown')
      await search.waitFor()
      await search.press('ArrowDown'); await search.press('Enter')
      assert.equal(await trigger.getAttribute('data-selected-service'), 'navaja')
      await trigger.click()
      await dialog.getByRole('button', { name: 'Barba', exact: true }).click()
      assert.equal(await dialog.getByRole('option').count(), 1)
      await search.fill('No existe')
      await dialog.getByRole('status').waitFor()
      assert.equal(await dialog.getByRole('option').count(), 0)
      await dialog.getByRole('button', { name: 'Ver todos los servicios' }).click()
      assert.equal(await dialog.getByRole('option').count(), 4)
      await search.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      await page.waitForFunction(() => document.activeElement?.id === 'booking-service')
      assert.equal(await trigger.getAttribute('data-selected-service'), 'navaja')
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true)
      await trigger.click()
      if (device === 'desktop') await page.getByRole('heading', { name: /Reserva tu/ }).click()
      else await page.mouse.click(4, 4)
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => document.getElementById('root').inert), false)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser.close() }
})
