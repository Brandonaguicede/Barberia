import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

// All API responses are isolated browser fixtures; this smoke test never writes production data.
test('panel administrativo adaptable: tarjetas, filtros, avisos, navegación y tabla en los anchos solicitados', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const base = process.env.SMOKE_URL || 'http://localhost:5173'
  const adminId = '10000000-0000-4000-8000-000000000091'
  const admin = { id: adminId, email: 'admin@responsive.test', role: 'authenticated', aud: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.')
  const dateInCostaRica = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const addDays = (date, days) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10) }
  const today = dateInCostaRica(new Date())
  const makeAppointment = (id, date, time, name, service, price, status) => ({
    id, client_name: name, client_phone: '88881234', client_email: `${id}@responsive.test`, barber_id: 'barber-1', barber_name: 'Axel Tenorio', service_id: 'service-1', service_name: service, service_duration: 30, service_price: price, status, starts_at: new Date(`${date}T${time}:00-06:00`).toISOString(), notes: 'Nota de prueba', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })
  const appointments = [
    makeAppointment('today-1', today, '09:00', 'Cliente de hoy', 'Corte clásico', 4000, 'confirmed'),
    makeAppointment('tomorrow-1', addDays(today, 1), '10:30', 'Cliente próximo', 'Corte con navaja', 5000, 'pending'),
    makeAppointment('past-1', addDays(today, -1), '14:00', 'Cliente anterior', 'Corte + barba', 7000, 'completed'),
  ]
  const notifications = [{ id: 'notice-1', title: 'Nueva cita de prueba', appointment_id: 'today-1', read_at: null, created_at: new Date().toISOString() }]
  try {
    await fs.mkdir('.npm-cache/screenshots', { recursive: true })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    const profile = { ...admin, active: true, subscription_expires_at: null, user_roles: { role: 'admin' }, barbers: [] }
    const catalog = { barbers: [{ id: 'barber-1', name: 'Axel Tenorio', active: true }], services: [{ id: 'service-1', name: 'Corte clásico', duration: 30, price: 4000, category: 'corte', active: true }], barber_services: [], settings: { shop_name: 'TENORIO BARBER', horizon_days: 90 } }
    await context.route(/\/(auth|rest|functions)\/v1\//, async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method()
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (method === 'OPTIONS') return route.fulfill({ status: 204 })
      if (url.pathname === '/auth/v1/token') return reply({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: admin })
      if (url.pathname === '/auth/v1/user') return reply(admin)
      if (url.pathname === '/functions/v1/booking') return reply(catalog)
      if (!url.pathname.startsWith('/rest/v1/')) return reply({})
      const table = url.pathname.split('/').at(-1)
      if (table === 'profiles') return reply(url.searchParams.has('id') ? profile : [profile])
      if (table === 'appointments') {
        let rows = [...appointments]
        const dateRanges = url.searchParams.getAll('starts_at')
        const startRange = dateRanges.find(value => value.startsWith('gte.'))
        const endRange = dateRanges.find(value => value.startsWith('lte.'))
        if (startRange) rows = rows.filter(row => row.starts_at >= startRange.slice(4))
        if (endRange) rows = rows.filter(row => row.starts_at <= endRange.slice(4))
        const status = url.searchParams.get('status')
        if (status?.startsWith('eq.')) rows = rows.filter(row => row.status === status.slice(3))
        const barber = url.searchParams.get('barber_id')
        if (barber?.startsWith('eq.')) rows = rows.filter(row => row.barber_id === barber.slice(3))
        return reply(rows.map(row => ({ ...row, barbers: { name: row.barber_name } })))
      }
      if (table === 'notifications') return reply(notifications)
      return reply([])
    })
    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(admin.email)
    await page.locator('#login-password').fill('fixture-password-12')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.goto(`${base}/admin/citas`)
    await page.getByRole('heading', { name: 'Citas', exact: true }).waitFor()
    await page.locator('[class*="mobileCards"]').getByText('Cliente de hoy', { exact: true }).waitFor()

    for (const width of [320, 375, 390, 430, 768, 1024]) {
      await page.setViewportSize({ width, height: width < 768 ? 850 : 900 })
      await page.evaluate(() => new Promise(requestAnimationFrame))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sin desbordamiento horizontal en ${width}px`)
      assert.equal(await page.locator('button[class*="btnNew"]').isVisible(), true, `CTA Nueva cita visible en ${width}px`)
      assert.equal(await page.locator('span[class*="mobileNewLabel"]').isVisible(), width < 768, `etiqueta compacta del CTA bajo 768px (${width})`)
      if (width < 768) {
        assert.equal(await page.locator('[class*="mobileCards"]').isVisible(), true, `tarjetas visibles en ${width}px`)
        assert.equal(await page.locator('[class*="tableWrap"]').isVisible(), false, `tabla oculta en ${width}px`)
        assert.equal(await page.getByRole('navigation', { name: 'Navegación administrativa' }).isVisible(), true, `navegación inferior visible en ${width}px`)
        assert.equal(await page.locator('details[class*="center"] > summary').isVisible(), true, `campana visible en ${width}px`)
        assert.equal(await page.locator('details[class*="center"] [class*="badge"]').isVisible(), true, `contador de avisos visible en ${width}px`)
        assert.equal(await page.getByText('Corte clásico', { exact: true }).first().isVisible(), true)
        assert.equal(await page.getByText(/₡4\s?000/).count() > 0, true, `precio real visible en ${width}px`)
        assert.equal(await page.getByRole('button', { name: 'Detalles' }).count() > 0, true)
        await page.screenshot({ path: `.npm-cache/screenshots/admin-responsive-${width}.png`, fullPage: true, animations: 'disabled' })
      } else {
        assert.equal(await page.locator('[class*="mobileCards"]').isVisible(), false, `tarjetas ocultas en ${width}px`)
        assert.equal(await page.locator('[class*="tableWrap"]').isVisible(), true, `tabla visible en ${width}px`)
        assert.equal(await page.getByRole('navigation', { name: 'Navegación administrativa' }).isVisible(), false, `navegación inferior oculta en ${width}px`)
        await page.screenshot({ path: `.npm-cache/screenshots/admin-responsive-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }

    await page.setViewportSize({ width: 390, height: 844 })
    const notificationCenter = page.locator('details[class*="center"]')
    await notificationCenter.locator('summary').click()
    assert.equal(await notificationCenter.evaluate(element => element.open), true, 'la campana abre el panel de avisos')
    assert.equal(await notificationCenter.locator('[class*="popover"]').isVisible(), true, 'el panel de avisos queda visible')
    assert.match(await notificationCenter.locator('[class*="popover"]').textContent(), /Nueva cita de prueba/)
    await notificationCenter.locator('summary').click()
    await page.getByRole('button', { name: 'Próximas' }).click()
    await page.locator('[class*="mobileCards"]').getByText('Cliente próximo', { exact: true }).waitFor()
    assert.equal(await page.locator('[class*="mobileCards"]').getByText('Cliente anterior', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Filtros' }).click()
    assert.equal(await page.getByLabel('Fecha', { exact: true }).isVisible(), true)
    await page.getByRole('button', { name: 'Más' }).click()
    await page.getByRole('link', { name: 'Servicios' }).waitFor()
    await page.getByRole('link', { name: 'Citas' }).click()
    await page.getByRole('button', { name: 'Detalles' }).first().click()
    await page.getByRole('heading', { name: 'Detalle de cita' }).waitFor()
    assert.deepEqual(errors, [])
    await context.close()
  } finally { await browser.close() }
})
