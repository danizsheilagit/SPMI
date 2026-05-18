/**
 * CSV Utilities untuk Instrumen AMI
 * Download template & parse CSV import
 */

const CSV_HEADERS = ['kode_butir', 'seksi', 'pertanyaan_audit', 'bukti_dokumen', 'urutan']

/**
 * Generate & download CSV template untuk sebuah instrumen
 */
export function downloadCsvTemplate(instrument, existingComponents = []) {
  const rows = [CSV_HEADERS.join(',')]

  if (existingComponents.length > 0) {
    existingComponents.forEach(comp => {
      const section = comp.rubric_schema?.section || ''
      const bukti = comp.rubric_schema?.bukti_dokumen || ''
      rows.push([
        escapeCsv(comp.code),
        escapeCsv(section),
        escapeCsv(comp.name),
        escapeCsv(bukti),
        comp.sort_order,
      ].join(','))
    })
  } else {
    // Sample row
    rows.push([
      '"1.1"',
      '"Perencanaan Pembelajaran"',
      '"Apakah SOP Pembelajaran tersedia dan disampaikan pada setiap rapat evaluasi"',
      '"SOP Pembelajaran"',
      '1',
    ].join(','))
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `template_${instrument.code.replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(val) {
  if (val == null) return '""'
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return '"' + s + '"'
}

/**
 * Parse CSV string → array of objects
 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { rows: [], error: 'CSV kosong atau hanya header' }

  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase())

  // Validate headers
  const required = ['kode_butir', 'pertanyaan_audit']
  for (const r of required) {
    if (!header.includes(r)) {
      return { rows: [], error: `Kolom wajib "${r}" tidak ditemukan di header CSV` }
    }
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i])
    const obj = {}
    header.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim() })

    if (!obj.kode_butir || !obj.pertanyaan_audit) continue // skip empty rows
    rows.push({
      code: obj.kode_butir,
      section: obj.seksi || '',
      name: obj.pertanyaan_audit,
      bukti_dokumen: obj.bukti_dokumen || '',
      sort_order: parseInt(obj.urutan) || (i),
    })
  }

  return { rows, error: null }
}

/**
 * Simple CSV line parser (handles quoted fields)
 */
function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
