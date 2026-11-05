import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

test('dashboard suma solo citas completadas y explica la instalación de avisos en iPhone', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const base = process.env.SMOKE_URL || 'http://localhost:5173'
  const barberMode = process.env.SMOKE_ROLE === 'barber'
  const adminId = '10000000-0000-4000-8000-000000000092'
  const admin = { id: adminId, email: 'admin@finanzas.test', role: 'authenticated', aud: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.')
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const previousDay = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
  const create = (id, date, time, client, price, status) => ({ id, barber_id: 'barber-1', barber_name: 'Axel Tenorio', barbers: { name: 'Axel Tenorio' }, service_id: 'service-1', service_name: 'Corte clásico', service_duration: 30, client_name: client, client_phone: '88881234', service_price: price, status, starts_at: new Date(`${date}T${time}:00-06:00`).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  const appointments = [
    create('completed-1', today, '09:00', 'Cliente completado A', 4500, 'completed'),
    create('completed-2', previousDay, '10:00', 'Cliente completado B', 6000, 'completed'),
    create('confirmed-1', today, '11:00', 'Cliente aún reservado', 4000, 'confirmed'),
  ]
  try {
    await fs.mkdir('.npm-cache/screenshots', { recursive: true })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    const profile = { ...admin, active: true, subscription_expires_at: null, user_roles: { role: barberMode ? 'barber' : 'admin' }, barbers: barberMode ? (process.env.SMOKE_BARBER_ARRAY ? [{ id: 'barber-1', name: 'Axel Tenorio' }] : { id: 'barber-1', name: 'Axel Tenorio' }) : null }
    await context.route(/\/(auth|rest|functions)\/v1\//, async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method()
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (method === 'OPTIONS') return route.fulfill({ status: 204 })
      if (url.pathname === '/auth/v1/token') return reply({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: admin })
      if (url.pathname === '/auth/v1/user') return reply(admin)
      if (!url.pathname.startsWith('/rest/v1/')) return reply({})
      const table = url.pathname.split('/').at(-1)
      if (table === 'profiles') return reply(url.searchParams.has('id') ? profile : [profile])
      if (url.pathname.endsWith('/rpc/appointment_stats')) return reply({ today: 2, pending: 0, upcoming: 1, monthlyRevenue: 10500 })
      if (table === 'appointments') {
        if (barberMode) assert.equal(url.searchParams.get('barber_id'), 'eq.barber-1')
        let rows = [...appointments]
        const statuses = url.searchParams.getAll('status')
        const status = statuses.find(value => value.startsWith('eq.'))
        if (status) rows = rows.filter(row => row.status === status.slice(3))
        const ranges = url.searchParams.getAll('starts_at')
        const from = ranges.find(value => value.startsWith('gte.'))
        const before = ranges.find(value => value.startsWith('lt.'))
        if (from) rows = rows.filter(row => row.starts_at >= from.slice(4))
        if (before) rows = rows.filter(row => row.starts_at < before.slice(3))
        return reply(rows)
      }
      if (table === 'notifications') return reply([])
      return reply([])
    })

    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(admin.email)
    await page.locator('#login-password').fill('fixture-password-12')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.waitForURL(`${base}/admin`)
    await page.getByRole('heading', { name: barberMode ? 'Mis ingresos por día' : 'Ingresos por día', exact: true }).waitFor()
    const daily = page.locator('section[aria-labelledby="daily-earnings-title"]')
    assert.match((await daily.locator('[class*="earningsTotal"]').textContent()).replace(/\s/g, ''), /4.?500/)
    const earnings = page.locator('section[aria-labelledby="completed-earnings-title"]')
    await earnings.getByText('Cliente completado A', { exact: true }).waitFor()
    assert.equal(await earnings.locator('[class*="earningRow"]').count(), 2)
    assert.equal(await earnings.getByText('Cliente aún reservado', { exact: true }).count(), 0)
    assert.match((await earnings.locator('[class*="earningsTotal"]').textContent()).replace(/\s/g, ''), /₡10.?500/)
    await page.screenshot({ path: '.npm-cache/screenshots/admin-earnings-iphone.png', fullPage: true, animations: 'disabled' })

    const notificationCenter = page.locator('details[class*="center"]')
    await notificationCenter.locator('summary').click()
    assert.equal(await notificationCenter.evaluate(element => element.open), true)
    assert.match(await notificationCenter.textContent(), /Activa las notificaciones en tu iPhone/)
    assert.match(await notificationCenter.textContent(), /Añadir a pantalla de inicio/)
    assert.equal(await page.getByRole('button', { name: 'Activar notificaciones' }).count(), 0)
    await page.screenshot({ path: '.npm-cache/screenshots/iphone-notification-guide.png', fullPage: true, animations: 'disabled' })
    appointments[2].status = 'completed'
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForFunction(() => document.querySelector('section[aria-labelledby="completed-earnings-title"]')?.textContent?.includes('Cliente aún reservado'))
    assert.equal(await earnings.locator('[class*="earningRow"]').count(), 3)
    assert.match((await daily.locator('[class*="earningsTotal"]').textContent()).replace(/\s/g, ''), /8.?500/)
    assert.deepEqual(errors, [])
    await context.close()
  } finally { await browser.close() }
})
