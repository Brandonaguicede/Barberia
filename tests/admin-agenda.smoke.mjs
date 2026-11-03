import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

// Isolated API fixtures: this test never creates staff or schedules in Supabase.
test('agenda editable desde el panel en escritorio y movil, sin datos reales', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { executablePath: process.env.SMOKE_BROWSER } : {}) })
  const base = process.env.SMOKE_URL || 'http://localhost:5173'
  const adminId = '10000000-0000-4000-8000-000000000001'
  const barberId = '20000000-0000-4000-8000-000000000001'
  const staffId = '10000000-0000-4000-8000-000000000002'
  const admin = { id: adminId, email: 'admin@agenda.test', role: 'authenticated', aud: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.')
  try {
    await fs.mkdir('.npm-cache/screenshots', { recursive: true })
    for (const [device, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      let sequence = 0, denyNextPatch = false
      const profile = { ...admin, active: true, subscription_expires_at: null, user_roles: { role: 'admin' }, barbers: [] }
      const state = {
        profiles: [profile],
        barbers: [{ id: barberId, name: 'Axel', user_id: null, active: true }],
        services: [{ id: 'service-1', name: 'Corte clasico', duration: 30, price: 4000, active: true, category: 'corte' }],
        barber_services: [], barber_schedules: [], barber_breaks: [], barber_time_off: [],
      }
      const settings = { id: true, shop_name: 'TENORIO BARBER', minimum_notice_minutes: 30, cancellation_notice_minutes: 120, reschedule_notice_minutes: 120, slot_interval_minutes: 15, buffer_minutes: 0, horizon_days: 90, reminder_minutes: 60, barber_can_manage_availability: false }
      await context.route(/\/(auth|rest|functions)\/v1\//, async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method()
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
        if (method === 'OPTIONS') return route.fulfill({ status: 204 })
        if (url.pathname === '/auth/v1/token') return reply({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: admin })
        if (url.pathname === '/auth/v1/user') return reply(admin)
        if (url.pathname === '/functions/v1/admin-users') {
          const body = request.postDataJSON()
          assert.equal(body.role, 'Barber'); assert.equal(body.barber_id, barberId)
          state.barbers[0].user_id = staffId
          state.profiles.push({ id: staffId, email: body.email, active: true, subscription_expires_at: null, user_roles: { role: 'barber' }, barbers: [{ id: barberId, name: 'Axel' }], created_at: new Date().toISOString() })
          return reply({ id: staffId })
        }
        if (!url.pathname.startsWith('/rest/v1/')) return reply({})
        const table = url.pathname.split('/').at(-1)
        if (table === 'booking_settings') {
          if (method === 'PATCH') Object.assign(settings, request.postDataJSON())
          return reply(settings)
        }
        if (table === 'profiles') return reply(url.searchParams.get('id') ? profile : state.profiles)
        if (!Object.hasOwn(state, table)) return reply([])
        const single = request.headers()['accept']?.includes('vnd.pgrst.object')
        const id = url.searchParams.get('id')?.replace('eq.', '')
        if (method === 'POST') {
          const body = request.postDataJSON()
          const rows = (Array.isArray(body) ? body : [body]).map(item => ({ ...item, id: `${table}-${++sequence}` }))
          state[table].push(...rows); return reply(single ? rows[0] : rows)
        }
        if (method === 'PATCH') {
          if (denyNextPatch) { denyNextPatch = false; return reply({ message: 'No se pudo guardar la regla', code: '42501' }, 403) }
          const row = state[table].find(row => row.id === id)
          assert.ok(row, 'La edicion debe apuntar a una regla existente')
          Object.assign(row, request.postDataJSON()); return reply(single ? row : [row])
        }
        if (method === 'DELETE') {
          const removed = state[table].filter(row => id ? row.id === id : row.service_id === url.searchParams.get('service_id')?.replace('eq.', ''))
          state[table] = state[table].filter(row => !removed.includes(row)); return reply(single ? removed[0] : removed)
        }
        return reply(state[table])
      })
      await page.goto(base + '/login')
      await page.getByLabel('Correo', { exact: true }).fill(admin.email)
      await page.locator('#login-password').fill('fixture-password-12')
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
      await page.waitForURL('**/admin')
      await page.goto(base + '/admin/barberos')
      await page.getByRole('link', { name: 'Configurar agenda de Axel' }).click()
      await page.getByRole('heading', { name: 'Completa estos pasos para habilitar las reservas' }).waitFor()
      await page.getByLabel('Tipo de cuenta').selectOption('new')
      await page.getByLabel('Correo del barbero').fill('axel@agenda.test')
      await page.getByLabel('Contraseña de acceso').fill('fixture-personal-12')
      await page.getByRole('button', { name: 'Crear y vincular cuenta' }).click()
      await page.getByText('La cuenta está activa y vinculada a este barbero.').waitFor()
      const service = page.getByRole('checkbox', { name: /Corte clasico/ })
      await service.check()
      await page.getByLabel('Lunes', { exact: true }).check()
      await page.getByLabel('Martes', { exact: true }).check()
      await page.getByLabel('Hora de inicio').fill('09:00')
      await page.getByLabel('Hora de fin').fill('18:00')
      await page.getByRole('button', { name: 'Guardar horario', exact: true }).click()
      await page.getByRole('button', { name: 'Editar Lunes', exact: true }).waitFor()
      assert.equal(state.barber_schedules.length, 2)
      await page.getByRole('heading', { name: 'Configuración completa para recibir reservas' }).waitFor()
      await page.getByRole('button', { name: 'Editar Lunes', exact: true }).click()
      await page.getByLabel('Hora de inicio').fill('10:00')
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      await page.getByText('Lunes · 10:00 — 18:00', { exact: true }).waitFor()
      assert.equal(state.barber_schedules.find(row => row.weekday === 1).opens_at, '10:00')
      await page.reload()
      await page.getByText('Lunes · 10:00 — 18:00', { exact: true }).waitFor()
      await page.getByLabel('Lunes', { exact: true }).check()
      await page.getByLabel('Hora de inicio').fill('11:00')
      await page.getByLabel('Hora de fin').fill('12:00')
      await page.getByRole('button', { name: 'Guardar horario', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'El intervalo coincide' }).waitFor()
      assert.equal(state.barber_schedules.length, 2)
      await page.getByLabel('Disponibilidad', { exact: true }).selectOption('barber_breaks')
      await page.getByLabel('Lunes', { exact: true }).check()
      await page.getByLabel('Hora de inicio').fill('12:00')
      await page.getByLabel('Hora de fin').fill('13:00')
      await page.getByRole('button', { name: 'Guardar descanso' }).click()
      await page.getByText('Lunes · 12:00 — 13:00', { exact: true }).waitFor()
      await page.getByLabel('Disponibilidad', { exact: true }).selectOption('barber_time_off')
      await page.getByLabel('Fecha y hora de inicio').fill('2026-12-01T09:00')
      await page.getByLabel('Fecha y hora de fin').fill('2026-12-02T18:00')
      await page.getByLabel('Motivo (opcional)').fill('Vacaciones de prueba')
      await page.getByRole('button', { name: 'Guardar bloqueo' }).click()
      await page.getByText('Vacaciones de prueba', { exact: true }).waitFor()
      assert.equal(state.barber_time_off[0].starts_at, '2026-12-01T15:00:00.000Z')
      await page.getByRole('button', { name: 'Editar bloqueo', exact: true }).click()
      assert.equal(await page.getByLabel('Fecha y hora de inicio').inputValue(), '2026-12-01T09:00')
      denyNextPatch = true
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'No se pudo guardar la regla' }).waitFor()
      await page.getByRole('button', { name: 'Cancelar edición' }).click()
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: 'Eliminar bloqueo', exact: true }).click()
      await page.getByText('No hay vacaciones ni bloqueos configurados.').waitFor()
      assert.equal(state.barber_time_off.length, 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.getByLabel('Disponibilidad', { exact: true }).selectOption('barber_schedules')
      while (await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).count()) await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).first().click()
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: `.npm-cache/screenshots/agenda-${device}.png`, fullPage: true, animations: 'disabled' })
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser.close() }
})
