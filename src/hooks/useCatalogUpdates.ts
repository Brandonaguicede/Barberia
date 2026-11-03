import { useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { CATALOG_EVENT, CATALOG_STORAGE_KEY } from '../services/catalogEvents'

export default function useCatalogUpdates(onChange: () => void, paused = false) {
  const callback = useRef(onChange)
  const pausedRef = useRef(paused)
  const pending = useRef(false)
  useEffect(() => { callback.current = onChange }, [onChange])
  useEffect(() => {
    pausedRef.current = paused
    if (!paused && pending.current && document.visibilityState !== 'hidden') { pending.current = false; callback.current() }
  }, [paused])
  useEffect(() => {
    let live = true, lastRevision: string | null = null, checking = false
    let debounce: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (!live) return
      if (pausedRef.current || document.visibilityState === 'hidden') { pending.current = true; return }
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (!live) return
        if (pausedRef.current || document.visibilityState === 'hidden') { pending.current = true; return }
        pending.current = false
        callback.current()
      }, 120)
    }
    const check = async () => {
      if (!live || checking || document.visibilityState === 'hidden' || !navigator.onLine) return
      checking = true
      try {
        const { data, error } = await supabase.from('catalog_revision').select('revision').eq('id', true).single()
        if (!live) return
        if (error || !data || !['string', 'number'].includes(typeof data.revision)) { refresh(); return }
        const revision = String(data.revision)
        if (lastRevision !== revision) { lastRevision = revision; refresh() }
      } catch { if (live) refresh() }
      finally { checking = false }
    }
    const resume = () => {
      if (document.visibilityState === 'hidden') return
      if (pending.current) refresh()
      void check()
    }
    const storage = (event: StorageEvent) => { if (event.key === CATALOG_STORAGE_KEY) refresh() }
    const channel = supabase.channel(`catalog:${crypto.randomUUID()}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'catalog_revision' }, payload => {
      if (payload.new.revision !== undefined) lastRevision = String(payload.new.revision)
      refresh()
    }).subscribe(status => { if (status === 'SUBSCRIBED') void check() })
    window.addEventListener(CATALOG_EVENT, refresh)
    window.addEventListener('storage', storage)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    // Recover missed websocket events without repeatedly calling the booking API.
    const timer = setInterval(() => { void check() }, 60000)
    void check()
    return () => {
      live = false
      clearTimeout(debounce); clearInterval(timer)
      window.removeEventListener(CATALOG_EVENT, refresh)
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
      void supabase.removeChannel(channel)
    }
  }, [])
}
