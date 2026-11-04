import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Brush, Check, ChevronDown, Clock3, Layers3, Paintbrush, Scissors, Search, Sparkles, X } from 'lucide-react'
import type { Service } from '../../types'
import styles from './ServicePicker.module.css'

interface Props { id: string; value: string; services: Service[]; onChange: (id: string) => void }
const MOBILE = '(max-width:760px), (max-height:500px)'
const CATEGORIES: Record<string, { label: string; icon: typeof Scissors }> = {
  corte: { label: 'Cortes', icon: Scissors }, barba: { label: 'Barba', icon: Brush }, combo: { label: 'Combos', icon: Layers3 }, color: { label: 'Color', icon: Paintbrush }, general: { label: 'Otros', icon: Sparkles },
}
const categoryInfo = (category: string) => CATEGORIES[category] || { label: category, icon: Sparkles }
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
const price = (value: number) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(value))

export default function ServicePicker({ id, value, services, onChange }: Props) {
  const uid = useId(), panelId = `${uid}-panel`, listId = `${uid}-list`
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [activeId, setActiveId] = useState('')
  const [position, setPosition] = useState({ above: false, maxHeight: 500 })
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null)
  const keyboardOpening = useRef(false)
  const selected = services.find(service => service.id === value)
  const categories = [...new Set(services.map(service => service.category))]
  const filtered = services.filter(service => (category === 'all' || service.category === category) && normalized(`${service.name} ${service.description || ''} ${categoryInfo(service.category).label}`).includes(normalized(query)))
  const active = filtered.find(service => service.id === activeId)?.id || filtered[0]?.id
  const SelectedIcon = selected ? categoryInfo(selected.category).icon : Scissors
  const close = (restore = true) => {
    setOpen(false)
    if (restore) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  const show = (keyboard = false, last = false) => {
    keyboardOpening.current = keyboard
    setQuery(''); setCategory('all'); setActiveId(selected?.id || (last ? services[services.length - 1]?.id : services[0]?.id) || '')
    setOpen(true)
  }
  const choose = (service: Service) => { onChange(service.id); close() }

  useEffect(() => {
    const media = window.matchMedia(MOBILE), change = () => setMobile(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const headerBottom = Math.max(12, document.querySelector('header')?.getBoundingClientRect().bottom || 0)
      const below = window.innerHeight - rect.bottom - 16, above = rect.top - headerBottom - 12
      const flip = below < 330 && above > below
      const maxHeight = Math.max(180, Math.min(520, flip ? above : below))
      setPosition(current => current.above === flip && current.maxHeight === maxHeight ? current : { above: flip, maxHeight })
    }
    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    if (trigger.current) observer.observe(trigger.current)
    observer.observe(document.documentElement)
    const frame = requestAnimationFrame(() => {
      if (mobile && !keyboardOpening.current) panel.current?.focus({ preventScroll: true })
      else search.current?.focus({ preventScroll: true })
      if (selected) document.getElementById(`${uid}-${selected.id}`)?.scrollIntoView({ block: 'nearest' })
    })
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update) }
  }, [open, mobile])
  useLayoutEffect(() => {
    if (!open || !mobile) return
    const root = document.getElementById('root'), wasInert = root?.inert, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (root) root.inert = true
    return () => { document.body.style.overflow = overflow; if (root) root.inert = Boolean(wasInert) }
  }, [open, mobile])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!mobile && !panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, mobile])

  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const service = filtered.find(item => item.id === active)
      if (service) choose(service)
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (!filtered.length) return
    const index = filtered.findIndex(item => item.id === active)
    const next = filtered[(index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length]
    setActiveId(next.id)
    requestAnimationFrame(() => document.getElementById(`${uid}-${next.id}`)?.scrollIntoView({ block: 'nearest' }))
  }
  const panelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (!mobile || event.key !== 'Tab') return
    const targets = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input:not([disabled])')
    const first = targets?.[0], last = targets?.[targets.length - 1]
    if (!first || !last) return
    if (document.activeElement === panel.current || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus()
    }
  }
  const dialog = <div ref={panel} id={panelId} role="dialog" aria-modal={mobile || undefined} aria-labelledby={`${uid}-title`} tabIndex={-1} className={`${styles.panel} ${position.above ? styles.above : ''} ${mobile ? styles.sheet : ''}`} data-keyboard={keyboardOpening.current || undefined} style={!mobile ? { maxHeight: position.maxHeight } : undefined} onKeyDown={panelKey} onBlur={event => { if (!mobile && event.relatedTarget && !panel.current?.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(false) }}>
    <div className={styles.panelHeader}><div><p>ENCONTRÁ TU ESTILO</p><h3 id={`${uid}-title`}>Elegí tu servicio</h3></div><button type="button" className={styles.close} aria-label="Cerrar selector de servicios" onClick={() => close()}><X size={18} aria-hidden="true" /></button></div>
    <div className={styles.search}><Search size={17} aria-hidden="true" /><input ref={search} type="search" role="combobox" autoComplete="off" placeholder="Buscar un servicio…" aria-label="Buscar servicio" aria-expanded="true" aria-controls={listId} aria-activedescendant={active ? `${uid}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActiveId('') }} onKeyDown={navigate} /></div>
    {categories.length > 1 && <div className={styles.categories} aria-label="Filtrar servicios por categoría">{['all', ...categories].map(key => <button key={key} type="button" aria-pressed={category === key} onClick={() => { setCategory(key); setActiveId('') }}>{key === 'all' ? 'Todos' : categoryInfo(key).label}</button>)}</div>}
    <div id={listId} role="listbox" aria-label="Servicios disponibles" className={styles.list}>
      {filtered.map(service => {
        const Icon = categoryInfo(service.category).icon, checked = service.id === value
        return <button type="button" role="option" aria-selected={checked} tabIndex={-1} id={`${uid}-${service.id}`} data-service-id={service.id} data-active={active === service.id || undefined} className={`${styles.option} ${checked ? styles.chosen : ''}`} key={service.id} onPointerMove={() => setActiveId(service.id)} onClick={() => choose(service)}>
          <span className={styles.optionIcon}><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span><span className={styles.optionInfo}><small>{categoryInfo(service.category).label}</small><strong>{service.name}</strong>{service.description && <span className={styles.description}>{service.description}</span>}<span className={styles.duration}><Clock3 size={12} aria-hidden="true" />{service.duration} min</span></span><span className={styles.optionMeta}><strong>{price(service.price)}</strong><span className={styles.radio} aria-hidden="true">{checked && <Check size={13} strokeWidth={2.5} />}</span></span>
        </button>
      })}
    </div>
    {filtered.length === 0 && <div className={styles.empty} role="status"><Search size={25} aria-hidden="true" /><p>No encontramos ese servicio.</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); search.current?.focus() }}>Ver todos los servicios</button></div>}
    <div className={styles.panelFooter}><span>{filtered.length} {filtered.length === 1 ? 'servicio' : 'servicios'}</span><span>Elegí el tuyo para continuar</span></div>
  </div>

  return <div className={`${styles.picker} ${open ? styles.isOpen : ''}`}>
    <button type="button" id={id} ref={trigger} aria-label="Servicio" aria-describedby={`${uid}-selection`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} data-selected-service={value} className={`${styles.trigger} ${selected ? styles.hasValue : ''}`} onPointerDown={() => { keyboardOpening.current = false }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(true, event.key === 'ArrowUp') } else if (event.key === 'Enter' || event.key === ' ') keyboardOpening.current = true }} onClick={() => open ? close() : show(keyboardOpening.current)}>
      <span className={styles.triggerIcon}><SelectedIcon size={23} strokeWidth={1.6} aria-hidden="true" /></span><span className={styles.selection} id={`${uid}-selection`}><strong>{selected?.name || 'Seleccioná tu servicio'}</strong><span>{selected ? <><Clock3 size={12} aria-hidden="true" />{selected.duration} min <i /> <b>{price(selected.price)}</b></> : `${services.length} servicios para tu próxima visita`}</span></span><span className={styles.chevron}><ChevronDown size={17} aria-hidden="true" /></span>
    </button>
    {open && (mobile ? createPortal(<div className={styles.backdrop} onPointerDown={event => { if (event.target === event.currentTarget) close() }}>{dialog}</div>, document.body) : dialog)}
  </div>
}
