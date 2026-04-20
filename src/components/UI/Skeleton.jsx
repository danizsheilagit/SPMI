/**
 * Skeleton UI — Shimmer loading placeholders
 * Digunakan sebagai pengganti spinner saat data sedang dimuat.
 */

// ── Primitif ────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      style={{
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
        backgroundSize: '400% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      }}
    />
  )
}

// ── Dashboard ──────────────────────────────────────────────────
export function SkeletonDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Banner */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </div>

      {/* Activity table */}
      <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <div className="space-y-3 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full ml-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Grid cards (Unit & Prodi, Instrumen) ──────────────────────
export function SkeletonGrid({ cols = 3, rows = 2 }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Filter bar */}
      <Skeleton className="h-12 w-full rounded-md" />

      {/* Card grid */}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-${cols}`}>
        {[...Array(cols * rows)].map((_, i) => (
          <div key={i} className="rounded-md border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Table (User Management, Audit Cycles) ───────────────────
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-md border border-gray-100 bg-white p-4 text-center space-y-2">
            <Skeleton className="h-7 w-8 mx-auto" />
            <Skeleton className="h-4 w-16 mx-auto rounded-full" />
          </div>
        ))}
      </div>

      {/* Info banner */}
      <Skeleton className="h-12 w-full rounded-md" />

      {/* Table */}
      <div className="rounded-md border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 flex gap-6">
          {[...Array(cols)].map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-20'}`} />
          ))}
        </div>
        {/* Data rows */}
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-gray-100 last:border-0 flex items-center gap-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 w-48 shrink-0">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Audit Cycles ─────────────────────────────────────────────
export function SkeletonCycles({ rows = 3 }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="rounded-md border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-64" />
                <div className="flex gap-4 mt-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Skeleton className="h-8 w-20 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
