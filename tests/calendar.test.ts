import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays, calendarCells, calendarDateLabel, calendarMonth, calendarWeekday, moveCalendarMonth } from '../src/utils/calendar.ts'

test('calendario: cambios de año y meses sin depender de la zona horaria del dispositivo', () => {
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29')
  assert.equal(moveCalendarMonth('2026-01-31', 1), '2026-02-28')
  assert.equal(moveCalendarMonth('2028-01-31', 1), '2028-02-29')
  assert.equal(moveCalendarMonth('2026-12-31', 1), '2027-01-31')
})
test('calendario: seis semanas continuas, lunes primero y dias del mes correctos', () => {
  for (const month of ['2026-11-01', '2027-02-01', '2028-02-01', '2026-12-01']) {
    const cells = calendarCells(month)
    assert.equal(cells.length, 42)
    assert.equal(new Set(cells.map(c => c.date)).size, 42)
    assert.equal(calendarWeekday(cells[0].date), 0)
    for (let i = 1; i < cells.length; i++) assert.equal(cells[i].date, addCalendarDays(cells[i - 1].date, 1))
    assert.ok(cells.filter(c => c.inMonth).every(c => calendarMonth(c.date) === month))
  }
  assert.equal(calendarCells('2028-02-01').filter(c => c.inMonth).length, 29)
  assert.equal(calendarCells('2027-02-01').filter(c => c.inMonth).length, 28)
  assert.match(calendarDateLabel('2026-11-03'), /martes.*3.*noviembre.*2026/)
})
