const asDate = (value: string) => new Date(`${value}T12:00:00Z`)
const iso = (date: Date) => date.toISOString().slice(0, 10)

export function addCalendarDays(value: string, offset: number): string {
  const date = asDate(value)
  date.setUTCDate(date.getUTCDate() + offset)
  return iso(date)
}
export const calendarMonth = (value: string) => `${value.slice(0, 7)}-01`
export function moveCalendarMonth(value: string, offset: number): string {
  const date = asDate(value), day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + offset)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return iso(date)
}
export function calendarCells(month: string): { date: string; day: number; inMonth: boolean }[] {
  const first = calendarMonth(month)
  const offset = (asDate(first).getUTCDay() + 6) % 7
  const start = addCalendarDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addCalendarDays(start, i)
    return { date, day: Number(date.slice(8)), inMonth: date.slice(0, 7) === first.slice(0, 7) }
  })
}
export const calendarDateLabel = (value: string) => new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(asDate(value))
export const calendarMonthLabel = (value: string) => new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(asDate(value))
export const calendarWeekday = (value: string) => (asDate(value).getUTCDay() + 6) % 7
