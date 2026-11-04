import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

test('catalogo vivo: cambios entre pestanas, conservacion del formulario y revision de cambios importantes', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const base = process.env.SMOKE_URL || 'http://localhost:5173'
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 900 } })
    const page = await context.newPage()
    let revision = 1, failCatalog = false
    const catalog = { services: [{ id: 'corte', name: 'Corte original', duration: 30, price: 4000, category: 'corte', active: true }], barbers: [{ id: 'axel', name: 'Axel', active: true }], barber_services: [{ service_id: 'corte', barber_id: 'axel' }], settings: { shop_name: 'TENORIO', horizon_days: 90 } }
    await context.route('**/rest/v1/catalog_revision*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ revision }) }))
    await context.route('**/functions/v1/booking', route => {
      const input = route.request().postDataJSON()
      if (input.action === 'catalog') return route.fulfill({ status: failCatalog ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failCatalog ? { message: 'Fallo simulado' } : { ...catalog, services: catalog.services.filter(s => s.active) }) })
      assert.equal(input.action, 'slots')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ barber_id: 'axel', starts_at: `${input.date}T15:00:00Z` }, { barber_id: 'axel', starts_at: `${input.date}T16:00:00Z` }]) })
    })
    await page.goto(base)
    await page.getByText('Corte original', { exact: true }).waitFor()
    const editor = await context.newPage(); await editor.goto(base + '/login')
    const changed = async () => {
      revision++
      await editor.evaluate(() => localStorage.setItem('tenorio:catalog-revision-hint', `${Date.now()}:${Math.random()}`))
      await page.bringToFront()
    }
    catalog.services[0].name = 'Corte actualizado'; catalog.services[0].price = 5500
    await changed()
    await page.getByText('Corte actualizado', { exact: true }).waitFor()
    assert.match((await page.getByLabel('Servicio', { exact: true }).textContent()).replace(/\s/g, ''), /5500/)
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: /^Mañana/ }).click()
    await page.getByRole('button', { name: '9:00 am', exact: true }).click()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByLabel('Nombre completo').fill('Cliente Conservado')
    await page.getByLabel('Telefono').fill('88881234')
    await page.getByText('Añadir correo o una nota (opcional)', { exact: true }).click()
    await page.getByLabel('Notas adicionales').fill('Preferencia conservada')
    catalog.services.push({ id: 'barba', name: 'Barba', price: 3000, duration: 20, active: true, category: 'barba' })
    catalog.barber_services.push({ service_id: 'barba', barber_id: 'axel' })
    const rechecked = page.waitForResponse(response => response.url().includes('/functions/v1/booking') && response.request().postDataJSON()?.action === 'slots')
    await changed(); await rechecked
    await page.getByRole('heading', { name: /3\. Datos de contacto/ }).waitFor()
    assert.equal(await page.getByLabel('Nombre completo').inputValue(), 'Cliente Conservado')
    assert.equal(await page.getByLabel('Telefono').inputValue(), '88881234')
    catalog.services[0].price = 6000
    await changed()
    await page.getByText('El precio del servicio se actualizó. Revísalo antes de continuar.').waitFor()
    await page.getByRole('heading', { name: /1\. Elige servicio/ }).waitFor()
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: '9:00 am', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '9:00 am', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    assert.equal(await page.getByLabel('Nombre completo').inputValue(), 'Cliente Conservado')
    assert.equal(await page.getByLabel('Notas adicionales').inputValue(), 'Preferencia conservada')
    catalog.services[0].duration = 45
    await changed()
    await page.getByRole('heading', { name: /2\. Selecciona fecha/ }).waitFor()
    await page.getByRole('button', { name: '9:00 am', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '9:00 am', exact: true }).getAttribute('aria-pressed'), 'false')
    assert.equal(await page.getByRole('button', { name: 'Continuar', exact: true }).isDisabled(), true)
    catalog.services[0].active = false
    await changed()
    await page.getByRole('heading', { name: /1\. Elige servicio/ }).waitFor()
    assert.equal(await page.getByLabel('Servicio', { exact: true }).getAttribute('data-selected-service'), 'barba')
    revision++; catalog.services[1].name = 'Servicio remoto'
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByText('Servicio remoto', { exact: true }).waitFor()
    failCatalog = true; await changed()
    await page.getByRole('alert').filter({ hasText: 'No pudimos actualizar los servicios' }).waitFor()
    assert.equal(await page.getByLabel('Servicio', { exact: true }).getAttribute('data-selected-service'), 'barba')
    failCatalog = false
    await page.getByRole('button', { name: 'Actualizar servicios', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'No pudimos actualizar los servicios' }).waitFor({ state: 'hidden' })
    await context.close()
  } finally { await browser.close() }
})
