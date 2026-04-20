/**
 * PPEPPChecklist — Core PPEPP evaluation component per butir penilaian.
 *
 * Scoring (Option B — Kumulatif Sequential):
 *   0 = tidak ada tahap yang terpenuhi
 *   1 = Penetapan ✓
 *   2 = Penetapan + Pelaksanaan ✓✓
 *   3 = + Evaluasi ✓✓✓
 *   4 = + Pengendalian ✓✓✓✓
 *   5 = + Peningkatan ✓✓✓✓✓
 *
 * A stage is "fulfilled" only when a file has been uploaded for it.
 * Sequential: stage N+1 is locked until stage N is fulfilled.
 */
import FileUpload from './FileUpload'
import { Lock, CheckCircle2, Circle } from 'lucide-react'

export const PPEPP_STAGES = [
  {
    key: 'penetapan',
    label: 'Penetapan',
    abbr: 'P',
    color: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-500' },
    defaultDesc: 'Dokumen penetapan/standar telah ditetapkan dan disahkan',
  },
  {
    key: 'pelaksanaan',
    label: 'Pelaksanaan',
    abbr: 'P',
    color: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'ring-indigo-500' },
    defaultDesc: 'Terdapat bukti pelaksanaan standar',
  },
  {
    key: 'evaluasi',
    label: 'Evaluasi',
    abbr: 'E',
    color: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', ring: 'ring-violet-500' },
    defaultDesc: 'Terdapat bukti evaluasi/monitoring',
  },
  {
    key: 'pengendalian',
    label: 'Pengendalian',
    abbr: 'P',
    color: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-500' },
    defaultDesc: 'Terdapat mekanisme pengendalian',
  },
  {
    key: 'peningkatan',
    label: 'Peningkatan',
    abbr: 'P',
    color: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', ring: 'ring-fuchsia-500' },
    defaultDesc: 'Terdapat bukti tindak lanjut/peningkatan',
  },
]

/** Compute cumulative sequential score from ppepp answers */
export function computePPEPPScore(ppepp) {
  let score = 0
  for (const stage of PPEPP_STAGES) {
    const s = ppepp?.[stage.key]
    if (s?.terpenuhi && s?.file_path) score++
    else break
  }
  return score
}

const MAX_SCORE = 5

function ScoreBar({ score }) {
  const pct = Math.round((score / MAX_SCORE) * 100)
  const color = score === 5
    ? 'bg-green-500'
    : score >= 3
    ? 'bg-blue-500'
    : score >= 1
    ? 'bg-amber-500'
    : 'bg-gray-300'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold tabular-nums ${
        score === MAX_SCORE ? 'text-green-600' : score > 0 ? 'text-blue-600' : 'text-gray-400'
      }`}>
        {score}/{MAX_SCORE}
      </span>
    </div>
  )
}

export default function PPEPPChecklist({
  componentId,
  componentCode,
  componentName,
  rubricSchema = {},
  submissionId,
  answers = {},     // { penetapan: { terpenuhi, file_path, file_name }, ... }
  onAnswerChange,   // (newAnswers) => void
  disabled = false,
}) {
  const ppepp = answers || {}
  const score = computePPEPPScore(ppepp)

  function isStageEnabled(idx) {
    if (idx === 0) return true
    const prev = PPEPP_STAGES[idx - 1]
    return !!ppepp[prev.key]?.terpenuhi && !!ppepp[prev.key]?.file_path
  }

  function isStageFulfilled(key) {
    return !!ppepp[key]?.terpenuhi && !!ppepp[key]?.file_path
  }

  function handleUploaded(stageKey, filePath, fileName) {
    const newPpepp = {
      ...ppepp,
      [stageKey]: { terpenuhi: true, file_path: filePath, file_name: fileName },
    }
    onAnswerChange?.(newPpepp)
  }

  function handleDeleted(stageKey, stageIdx) {
    // When a stage is deleted, all subsequent stages are also cleared (sequential rule)
    const newPpepp = { ...ppepp }
    for (let i = stageIdx; i < PPEPP_STAGES.length; i++) {
      const k = PPEPP_STAGES[i].key
      newPpepp[k] = { terpenuhi: false, file_path: null, file_name: null }
    }
    onAnswerChange?.(newPpepp)
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 uppercase tracking-wide">
              {componentCode}
            </span>
            <h4 className="text-sm font-semibold text-gray-900 truncate">{componentName}</h4>
          </div>
        </div>
        <div className="shrink-0 w-36">
          <p className="text-[10px] text-gray-400 mb-0.5 text-right">Skor PPEPP</p>
          <ScoreBar score={score} />
        </div>
      </div>

      {/* PPEPP Stages */}
      <div className="divide-y divide-gray-100">
        {PPEPP_STAGES.map((stage, idx) => {
          const enabled = isStageEnabled(idx) && !disabled
          const fulfilled = isStageFulfilled(stage.key)
          const stageData = ppepp[stage.key] || {}
          const schemaDesc = rubricSchema?.ppepp?.[stage.key]?.deskripsi || stage.defaultDesc

          // storage path for this evidence file
          const filePath = `${submissionId}/${componentId}/${stage.key}`

          return (
            <div
              key={stage.key}
              className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${
                !enabled && !fulfilled ? 'opacity-40' : ''
              } ${fulfilled ? 'bg-green-50/40' : ''}`}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {fulfilled ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                ) : !enabled ? (
                  <Lock className="h-4.5 w-4.5 text-gray-300" />
                ) : (
                  <Circle className="h-4.5 w-4.5 text-gray-300" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold ${stage.color.bg} ${stage.color.text}`}>
                    {stage.abbr}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{schemaDesc}</p>

                {/* File upload / file indicator */}
                {(enabled || fulfilled) && (
                  <FileUpload
                    bucket="evidence-files"
                    storagePath={filePath}
                    existingPath={fulfilled ? stageData.file_path : null}
                    existingName={stageData.file_name}
                    onUploaded={(path, name) => handleUploaded(stage.key, path, name)}
                    onDeleted={() => handleDeleted(stage.key, idx)}
                    disabled={!enabled || disabled}
                  />
                )}

                {/* Locked hint */}
                {!enabled && !fulfilled && idx > 0 && (
                  <p className="text-[11px] text-gray-400">
                    Selesaikan <span className="font-medium">{PPEPP_STAGES[idx - 1].label}</span> terlebih dahulu
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
