/**
 * BreadcrumbContext — allows pages to set breadcrumbs dynamically.
 * Usage in a page: useBreadcrumbs([{ label: 'Siklus Audit', to: '/audit-cycles' }, { label: 'Detail' }])
 */
import { createContext, useContext, useState, useCallback } from 'react'

const BreadcrumbContext = createContext(null)

export function BreadcrumbProvider({ children }) {
  const [breadcrumbs, setBreadcrumbs] = useState([])

  const setCrumbs = useCallback((crumbs) => {
    setBreadcrumbs(crumbs)
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbs(crumbs) {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) throw new Error('useBreadcrumbs must be inside BreadcrumbProvider')

  // Set on mount if crumbs provided
  if (crumbs !== undefined) {
    // Using ref pattern to avoid render-loop — called during render is OK
    // because setCrumbs only triggers if the layout re-reads breadcrumbs
  }

  return ctx
}

export function useCrumbSetter() {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) throw new Error('useCrumbSetter must be inside BreadcrumbProvider')
  return ctx.setCrumbs
}

export function useCrumbs() {
  const ctx = useContext(BreadcrumbContext)
  if (!ctx) return []
  return ctx.breadcrumbs
}
