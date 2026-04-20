/** Reusable submission status badge */
const STATUS_CONFIG = {
  draft:           { label: 'Draf',         className: 'bg-gray-100 text-gray-600' },
  submitted:       { label: 'Terkirim',     className: 'bg-blue-100 text-blue-700' },
  under_review:    { label: 'Ditinjau',     className: 'bg-amber-100 text-amber-700' },
  revision_needed: { label: 'Perlu Revisi', className: 'bg-red-100 text-red-700' },
  verified:        { label: 'Diverifikasi', className: 'bg-green-100 text-green-700' },
  closed:          { label: 'Selesai',      className: 'bg-slate-100 text-slate-600' },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
