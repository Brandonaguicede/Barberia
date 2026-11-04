import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addCalendarDays, calendarCells, calendarDateLabel, calendarMonth, calendarMonthLabel, calendarWeekday, moveCalendarMonth } from '../../utils/calendar'
import styles from './BookingCalendar.module.css'

interface Props { value: string; minDate: string; maxDate: string; onChange: (date: string) => void }
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function BookingCalendar({ value, minDate, maxDate, onChange }: Props) {
  const id = useId()
  const [month, setMonth] = useState(() => calendarMonth(value || minDate))
  const [focused, setFocused] = useState(value || minDate)
  const firstMonth = calendarMonth(minDate), lastMonth = calendarMonth(maxDate)
  const cells = calendarCells(month)
  const weekCount = cells.slice(35).some(cell => cell.inMonth) ? 6 : cells.slice(28).some(cell => cell.inMonth) ? 5 : 4
  const monthName = new Intl.DateTimeFormat('es-CR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`))
  const tabDate = cells.some(cell => cell.date === focused && cell.inMonth && cell.date >= minDate && cell.date <= maxDate) ? focused : cells.find(cell => cell.inMonth && cell.date >= minDate && cell.date <= maxDate)?.date
  useEffect(() => {
    if (value && value >= minDate && value <= maxDate) { setMonth(calendarMonth(value)); setFocused(value) }
  }, [value, minDate, maxDate])
  const legal = (date: string) => date >= minDate && date <= maxDate
  const quickDays = [{ label: 'Hoy', date: minDate }, { label: 'Mañana', date: addCalendarDays(minDate, 1) }, { label: 'En 7 días', date: addCalendarDays(minDate, 7) }].filter(day => legal(day.date))
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
    setMonth(calendarMonth(next)); setFocused(next)
    const target = `${id}-${next}`
    requestAnimationFrame(() => document.getElementById(target)?.focus({ preventScroll: true }))
  }
  return <div className={styles.wrapper}>
    <div className={styles.shortcuts} aria-label="Fechas rápidas">{quickDays.map(day => <button type="button" key={day.date} aria-pressed={value === day.date} className={value === day.date ? styles.quickSelected : ''} onClick={() => onChange(day.date)}>{day.label}<span>{new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))}</span></button>)}</div>
    <div className={styles.calendar}>
      <div className={styles.monthNav}><div><p>ELIGE UNA FECHA</p><h3 id={`${id}-month`} aria-live="polite" aria-label={calendarMonthLabel(month)}>{monthName} <span>{month.slice(0, 4)}</span></h3></div><div className={styles.monthButtons}><button type="button" aria-label="Mes anterior" disabled={month <= firstMonth} onClick={() => changeMonth(-1)}><ChevronLeft size={19} aria-hidden="true" /></button><button type="button" aria-label="Mes siguiente" disabled={month >= lastMonth} onClick={() => changeMonth(1)}><ChevronRight size={19} aria-hidden="true" /></button></div></div>
      <div role="grid" aria-label="Fecha de la cita" aria-describedby={`${id}-month`} className={styles.grid}>
        <div role="row" className={styles.weekRow}>{WEEKDAYS.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
        {Array.from({ length: weekCount }, (_, week) => <div key={week} role="row" className={styles.weekRow}>{cells.slice(week * 7, week * 7 + 7).map(cell => {
          const selected = value === cell.date, today = minDate === cell.date, disabled = !cell.inMonth || !legal(cell.date)
          return <div role="gridcell" aria-selected={selected} key={cell.date}><button type="button" id={`${id}-${cell.date}`} data-calendar-date={cell.date} tabIndex={!disabled && tabDate === cell.date ? 0 : -1} disabled={disabled} aria-hidden={!cell.inMonth || undefined} aria-label={calendarDateLabel(cell.date)} aria-current={today ? 'date' : undefined} aria-pressed={selected} className={`${styles.day} ${selected ? styles.selected : ''} ${today ? styles.today : ''} ${!cell.inMonth ? styles.outside : ''}`} onClick={() => { setFocused(cell.date); onChange(cell.date) }} onFocus={() => setFocused(cell.date)} onKeyDown={event => handleKey(event, cell.date)}>{cell.inMonth ? cell.day : ''}</button></div>
        })}</div>)}
      </div>
      <div className={styles.legend}><span><i />Hoy</span><span><i />Día seleccionado</span></div>
    </div>
    <p className={styles.dateSummary} aria-live="polite">{value && <CalendarDays size={17} aria-hidden="true" />}<span>{value ? calendarDateLabel(value) : 'Selecciona un día para ver las horas disponibles.'}</span></p>
  </div>
}
