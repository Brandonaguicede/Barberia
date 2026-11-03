import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { localDate } from '../src/utils/booking.ts'
import { addCalendarDays } from '../src/utils/calendar.ts'

test('calendario: teclado, limites, barbero real, reintento y respuestas antiguas', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const today = localDate(), tomorrow = addCalendarDays(today, 1), slowDate = addCalendarDays(today, 2), emptyDate = addCalendarDays(today, 3)
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    let failed = false, releaseSlow
    await context.route('**/functions/v1/booking', async route => {
      const body = route.request().postDataJSON()
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (body.action === 'catalog') return reply({
        barbers: [{ id: 'axel', name: 'Axel', active: true }, { id: 'bruno', name: 'Bruno', active: true }],
        services: [{ id: 'corte', name: 'Corte', category: 'corte', price: 4000, duration: 30, active: true }, { id: 'barba', name: 'Barba', category: 'barba', price: 3000, duration: 20, active: true }],
        barber_services: [{ barber_id: 'axel', service_id: 'corte' }, { barber_id: 'bruno', service_id: 'barba' }], settings: { horizon_days: 7, shop_name: 'TENORIO BARBER' },
      })
      assert.equal(body.barber_id, 'bruno')
      if (body.date === tomorrow && !failed) { failed = true; return reply({ message: 'Sin conexion de prueba' }, 503) }
      if (body.date === tomorrow) return reply([{ barber_id: 'bruno', starts_at: `${tomorrow}T16:00:00Z` }])
      if (body.date === slowDate) {
        await new Promise(resolve => { releaseSlow = resolve })
        return reply([{ barber_id: 'bruno', starts_at: `${slowDate}T20:00:00Z` }])
      }
      return reply([])
    })
    await page.goto(process.env.SMOKE_URL || 'http://localhost:5173')
    await page.getByLabel('Servicio', { exact: true }).selectOption('corte')
    assert.equal(await page.getByRole('button', { name: /Axel/ }).getAttribute('aria-pressed'), 'true')
    await page.getByLabel('Servicio', { exact: true }).selectOption('barba')
    assert.equal(await page.getByRole('button', { name: /Bruno/ }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByRole('button', { name: /Axel/ }).count(), 0)
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    const current = page.locator(`[data-calendar-date="${today}"]`)
    await current.focus(); await page.keyboard.press('ArrowRight')
    await page.waitForFunction(expected => document.activeElement?.getAttribute('data-calendar-date') === expected, tomorrow)
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-calendar-date')), tomorrow)
    await page.keyboard.press('Enter')
    await page.getByRole('alert').filter({ hasText: 'No pudimos consultar las horas' }).waitFor()
    await page.getByRole('button', { name: 'Volver a intentar', exact: true }).click()
    await page.getByRole('button', { name: '10:00 am', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Continuar', exact: true }).isEnabled(), true)
    const slowRequest = page.waitForRequest(r => r.url().includes('/functions/v1/booking') && r.postDataJSON()?.date === slowDate)
    if (slowDate.slice(0, 7) !== tomorrow.slice(0, 7)) await page.getByRole('button', { name: 'Mes siguiente' }).click()
    await page.locator(`[data-calendar-date="${slowDate}"]`).click(); await slowRequest
    if (emptyDate.slice(0, 7) !== slowDate.slice(0, 7)) await page.getByRole('button', { name: 'Mes siguiente' }).click()
    await page.locator(`[data-calendar-date="${emptyDate}"]`).click()
    await page.getByText('No quedan horas para este día.', { exact: true }).waitFor()
    const oldResponse = page.waitForResponse(r => r.url().includes('/functions/v1/booking') && r.request().postDataJSON()?.date === slowDate)
    releaseSlow(); await oldResponse
    await page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await page.getByRole('button', { name: '2:00 pm', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Continuar', exact: true }).isDisabled(), true)
    while (await page.getByRole('button', { name: 'Mes siguiente' }).isEnabled()) await page.getByRole('button', { name: 'Mes siguiente' }).click()
    const maxDate = addCalendarDays(today, 7)
    assert.equal(await page.locator(`[data-calendar-date="${addCalendarDays(maxDate, 1)}"]`).isDisabled(), true)
    assert.equal(await page.locator('input[type="date"]').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await context.close()
  } finally { await browser.close() }
})
