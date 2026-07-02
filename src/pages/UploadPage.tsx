import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'
import { parseExcelFile, validateStudentData, processStudentData } from '../lib/dataProcessing'
import type { ProcessedStudent } from '../lib/dataProcessing'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, X, AlertCircle } from 'lucide-react'

interface FileStatus {
  file: File
  status: 'pending' | 'processing' | 'success' | 'error'
  records: number
  errors: string[]
}

export function UploadPage() {
  const { user } = useAuth()
  const { students, setStudents, addUpload } = useSession()
  const [files, setFiles] = useState<FileStatus[]>([])
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ total: number; saved: number; duplicates: number; errors: string[] } | null>(null)

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    setFiles(prev => [...prev, ...valid.map(f => ({ file: f, status: 'pending' as const, records: 0, errors: [] }))])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const processFiles = async () => {
    if (!files.length || processing) return
    setProcessing(true)
    setResult(null)

    const allData: Parameters<typeof processStudentData>[0] = []
    const allErrors: string[] = []
    let totalRecords = 0
    const fileRecordCounts: number[] = []

    for (let i = 0; i < files.length; i++) {
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f))
      try {
        const data = await parseExcelFile(files[i].file)
        const { valid, errors } = validateStudentData(data)
        if (!valid) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', errors } : f))
          allErrors.push(...errors.map(e => `${files[i].file.name}: ${e}`))
          fileRecordCounts.push(0)
          continue
        }
        allData.push(...data)
        totalRecords += data.length
        fileRecordCounts.push(data.length)
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success', records: data.length } : f))
      } catch {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', errors: ['Failed to parse file'] } : f))
        allErrors.push(`${files[i].file.name}: Failed to parse`)
        fileRecordCounts.push(0)
      }
    }

    let saved = 0
    let duplicates = 0

    if (allData.length > 0) {
      const { processed, errors } = await processStudentData(allData, user?.tfc_id ?? '')
      allErrors.push(...errors)

      // Requirement #1 + #3: merge into the TFC-scoped in-memory store,
      // deduplicating by application_no so each student is assigned to
      // exactly one TFC (the logged-in one).
      const byAppNo = new Map<string, ProcessedStudent>()
      for (const s of students) byAppNo.set(s.application_no, s)
      for (const s of processed) {
        if (byAppNo.has(s.application_no)) duplicates++
        else { byAppNo.set(s.application_no, s); saved++ }
      }
      const merged = [...byAppNo.values()]
      setStudents(merged)

      files.forEach((f, i) => addUpload(f.file.name, fileRecordCounts[i] ?? 0, []))
    }

    setResult({ total: totalRecords, saved, duplicates, errors: allErrors })
    setProcessing(false)
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Files</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload Excel files to merge and process for TFC {user?.tfc_id}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div
          onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all"
        >
          <input type="file" id="file-input" accept=".xlsx,.xls" multiple onChange={handleSelect} className="hidden" />
          <label htmlFor="file-input" className="cursor-pointer block">
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600 text-sm">Drop Excel files here or <span className="text-blue-600">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Supports .xlsx and .xls</p>
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">{files.length} file(s) selected</span>
              <button onClick={() => { setFiles([]); setResult(null) }} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
            </div>
            <div className="space-y-2">
              {files.map((fs, i) => (
                <div key={`${fs.file.name}-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {fs.status === 'pending' && <FileSpreadsheet className="w-7 h-7 text-gray-400 flex-shrink-0" />}
                  {fs.status === 'processing' && <Loader2 className="w-7 h-7 text-blue-500 animate-spin flex-shrink-0" />}
                  {fs.status === 'success' && <CheckCircle className="w-7 h-7 text-green-500 flex-shrink-0" />}
                  {fs.status === 'error' && <XCircle className="w-7 h-7 text-red-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{fs.file.name}</p>
                    <p className="text-xs text-gray-400">
                      {fs.status === 'success' ? `${fs.records} records processed` :
                       fs.status === 'error' ? fs.errors[0] :
                       fs.status === 'processing' ? 'Processing...' : 'Ready to process'}
                    </p>
                  </div>
                  {fs.status === 'pending' && (
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-gray-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="font-semibold text-blue-900 text-sm mb-3">Processing Complete</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Total Records', value: result.total, color: 'text-gray-800' },
                { label: 'Saved', value: result.saved, color: 'text-green-600' },
                { label: 'Duplicates', value: result.duplicates, color: 'text-amber-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-xs font-medium text-red-700 mb-1">{result.errors.length} error(s)</p>
                {result.errors.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
          </div>
        )}

        <button
          onClick={processFiles} disabled={!files.length || processing}
          className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing
            ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
            : <><Upload className="w-4 h-4" />Process {files.length || 0} file(s)</>}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Required Excel Columns</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['APPLICATION NO.', 'Name', 'Final college code', 'College name', 'Branch Code'].map(col => (
            <span key={col} className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">{col}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Auto-detects header row — title rows above headers are skipped. Column variations accepted. All records are assigned to the logged-in TFC.</p>
      </div>
    </div>
  )
}
