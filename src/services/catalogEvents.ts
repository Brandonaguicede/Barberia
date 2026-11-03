export const CATALOG_EVENT = 'tenorio:catalog-changed'
export const CATALOG_STORAGE_KEY = 'tenorio:catalog-revision-hint'

export function notifyCatalogChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CATALOG_EVENT))
  try {
    // Only an invalidation hint crosses tabs, never catalog data or credentials.
    localStorage.setItem(CATALOG_STORAGE_KEY, `${Date.now()}:${Math.random().toString(36).slice(2)}`)
  } catch { /* Realtime and visibility checks still synchronize the catalog. */ }
}
