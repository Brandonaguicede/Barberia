import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { addCalendarDays, calendarCells, calendarDateLabel, calendarMonth, calendarMonthLabel, calendarWeekday, moveCalendarMonth } from '../../utils/calendar'
import styles from './BookingCalendar.module.css'

interface Props { value: string; minDate: string; maxDate: string; workingWeekdays: number[] | null; onChange: (date: string) => void }
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export default function BookingCalendar({ value, minDate, maxDate, workingWeekdays, onChange }: Props) {
  const id = useId()
  const [month, setMonth] = useState(() => calendarMonth(value || minDate))
  const [focused, setFocused] = useState(value || minDate)
  const firstMonth = calendarMonth(minDate), lastMonth = calendarMonth(maxDate)
  const cells = calendarCells(month)
  const weekCount = cells.slice(35).some(cell => cell.inMonth) ? 6 : cells.slice(28).some(cell => cell.inMonth) ? 5 : 4
  const monthName = new Intl.DateTimeFormat('es-CR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`))
  const legal = (date: string) => date >= minDate && date <= maxDate
  const hasSchedule = (date: string) => workingWeekdays === null || workingWeekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())
  const selectable = (date: string) => legal(date) && hasSchedule(date)
  const tabDate = cells.some(cell => cell.date === focused && cell.inMonth && selectable(cell.date)) ? focused : cells.find(cell => cell.inMonth && selectable(cell.date))?.date
  useEffect(() => {
    if (value && value >= minDate && value <= maxDate) { setMonth(calendarMonth(value)); setFocused(value) }
  }, [value, minDate, maxDate])
  let nextWorkday = ''
  for (let offset = 2; offset <= 7; offset++) {
    const date = addCalendarDays(minDate, offset)
    if (selectable(date)) { nextWorkday = date; break }
  }
  const quickDays = [{ label: 'Hoy', date: minDate }, { label: 'Mañana', date: addCalendarDays(minDate, 1) }, ...(nextWorkday ? [{ label: 'Próximo día de trabajo', date: nextWorkday }] : [])].filter((day, index, days) => legal(day.date) && days.findIndex(item => item.date === day.date) === index)
  const changeMonth = (offset: number) => {
    const next = calendarMonth(moveCalendarMonth(month, offset))
    if (next < firstMonth || next > lastMonth) return
    setMonth(next); setFocused(next < minDate ? minDate : value && calendarMonth(value) === next ? value : next)
  }
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    let next: string | undefined
    if (event.key === 'ArrowLeft') next = addCalendarDays(date, -1)
    if (event.key === 'ArrowRight') next = addCalendarDays(date, 1)
    if (event.key === 'ArrowUp') next = addCalendarDays(date, -7)
    if (event.key === 'ArrowDown') next = addCalendarDays(date, 7)
    if (event.key === 'Home') next = addCalendarDays(date, -calendarWeekday(date))
    if (event.key === 'End') next = addCalendarDays(date, 6 - calendarWeekday(date))
    if (event.key === 'PageUp') next = moveCalendarMonth(date, -1)
    if (event.key === 'PageDown') next = moveCalendarMonth(date, 1)
    if (!next) return
    event.preventDefault()
    next = next < minDate ? minDate : next > maxDate ? maxDate : next
    const increment = event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'PageUp' ? -1 : 1
    for (let attempts = 0; attempts < 7 && !selectable(next); attempts++) next = addCalendarDays(next, increment)
    if (!selectable(next)) return
    setMonth(calendarMonth(next)); setFocused(next)
    const target = `${id}-${next}`
    requestAnimationFrame(() => document.getElementById(target)?.focus({ preventScroll: true }))
  }
  const workdayLabels = workingWeekdays === null ? '' : [...new Set(workingWeekdays)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(day => DAY_NAMES[day]).join(', ')
  return <div className={styles.wrapper}>
    {workingWeekdays !== null && <p className={styles.workdays}><Clock3 size={14} aria-hidden="true" />{workdayLabels ? `Días de atención: ${workdayLabels}` : 'Este barbero aún no tiene días de atención configurados.'}</p>}
    <div className={styles.shortcuts} aria-label="Fechas rápidas">{quickDays.map(day => { const works = hasSchedule(day.date); return <button type="button" key={day.date} disabled={!works} aria-pressed={value === day.date} aria-label={`${day.label}, ${calendarDateLabel(day.date)}${works ? '' : ', el barbero no trabaja este día'}`} className={`${value === day.date ? styles.quickSelected : ''} ${!works ? styles.quickDisabled : ''}`} onClick={() => { setFocused(day.date); setMonth(calendarMonth(day.date)); onChange(day.date) }}>{day.label}<span>{works ? new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`)) : 'Sin horario'}</span></button> })}</div>
    <div className={styles.calendar}>
      <div className={styles.monthNav}><div><p>ELIGE UNA FECHA</p><h3 id={`${id}-month`} aria-live="polite" aria-label={calendarMonthLabel(month)}>{monthName} <span>{month.slice(0, 4)}</span></h3></div><div className={styles.monthButtons}><button type="button" aria-label="Mes anterior" disabled={month <= firstMonth} onClick={() => changeMonth(-1)}><ChevronLeft size={19} aria-hidden="true" /></button><button type="button" aria-label="Mes siguiente" disabled={month >= lastMonth} onClick={() => changeMonth(1)}><ChevronRight size={19} aria-hidden="true" /></button></div></div>
      <div role="grid" aria-label="Fecha de la cita" aria-describedby={`${id}-month`} className={styles.grid}>
        <div role="row" className={styles.weekRow}>{WEEKDAYS.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
        {Array.from({ length: weekCount }, (_, week) => <div key={week} role="row" className={styles.weekRow}>{cells.slice(week * 7, week * 7 + 7).map(cell => {
          const selected = value === cell.date, today = minDate === cell.date, works = hasSchedule(cell.date), disabled = !cell.inMonth || !selectable(cell.date)
          return <div role="gridcell" aria-selected={selected} key={cell.date}><button type="button" id={`${id}-${cell.date}`} data-calendar-date={cell.date} tabIndex={!disabled && tabDate === cell.date ? 0 : -1} disabled={disabled} aria-hidden={!cell.inMonth || undefined} aria-label={`${calendarDateLabel(cell.date)}${!works ? ', el barbero no trabaja este día' : ''}`} aria-current={today ? 'date' : undefined} aria-pressed={selected} className={`${styles.day} ${selected ? styles.selected : ''} ${today ? styles.today : ''} ${!cell.inMonth ? styles.outside : ''}`} onClick={() => { setFocused(cell.date); onChange(cell.date) }} onFocus={() => setFocused(cell.date)} onKeyDown={event => handleKey(event, cell.date)}>{cell.inMonth ? cell.day : ''}</button></div>
        })}</div>)}
      </div>
      <div className={styles.legend}><span><i />Hoy</span><span><i />Día seleccionado</span></div>
      <p className={styles.rangeNote}>Puedes elegir fechas hasta el <time dateTime={maxDate}>{new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${maxDate}T12:00:00Z`))}</time></p>
    </div>
    <p className={styles.dateSummary} aria-live="polite">{value && <CalendarDays size={17} aria-hidden="true" />}<span>{value ? calendarDateLabel(value) : 'Selecciona un día para ver las horas disponibles.'}</span></p>
  </div>
}
