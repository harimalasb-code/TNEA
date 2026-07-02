import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import { deduplicateStudents, generateFormattedStudentReport, generateCollegeAssignmentReport } from '../lib/dataProcessing'
import type { ProcessedStudent } from '../lib/dataProcessing'
import { Download, FileSpreadsheet, Loader2, CheckCircle, Building2 } from 'lucide-react'

interface Zone { id: string; zone_name: string }

type ReportId = 'all' | 'general' | 'govt' | 'zone_students' | 'zone_colleges'

const quotaLabel = (q: string) => (q === 'govt_7.5' ? 'Govt 7.5%' : 'General')

function rowFromStudent(s: ProcessedStudent, zoneName: string) {
  return {
    'TFC No': s.tfc_no,
    'Application No': s.application_no,
    'Name': s.name,
    'College Code': s.final_college_code,
    'College Name': s.college_name,
    'Branch Code': s.branch_code,
    'Quota': quotaLabel(s.quota_type),
    'Zone': zoneName || 'N/A',
  }
}

export function ReportsPage() {
  const { students } = useSession()
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState('')
  const [generating, setGenerating] = useState<ReportId | ''>('')
  const [done, setDone] = useState<ReportId | ''>('')

  useEffect(() => {
    // zones are shared reference data (not TFC-scoped) so they stay in
    // Supabase. Students come from the in-memory session store instead.
    supabase.from('zones').select('id, zone_name').order('zone_name').then(({ data }) => {
      if (data) setZones(data)
    })
  }, [])

  // Requirement #3: deduplicate before every report so each student is
  // assigned to exactly one TFC number in the final result.
  const deduped = deduplicateStudents(students)

  const downloadStudentReport = (type: 'all' | 'general' | 'govt') => {
    setGenerating(type)
    setDone('')
    try {
      const zoneNameMap = new Map<string, string>()
      for (const z of zones) zoneNameMap.set(z.id, z.zone_name)

      let list = deduped
      if (type === 'general') list = list.filter(s => s.quota_type === 'general')
      else if (type === 'govt') list = list.filter(s => s.quota_type === 'govt_7_5')

      if (!list.length) { alert('No data found for this report'); return }

      const rows = list.map(s => rowFromStudent(s, s.zone_id ? zoneNameMap.get(s.zone_id) ?? '' : ''))

      const labels: Record<string, [string, string, string]> = {
        all:     ['TNEA ALLOTMENT SYSTEM', 'ROUND I – ALL QUOTA – ACCEPT AND UPWARD', 'ALLOTTED STUDENTS LIST'],
        general: ['TNEA ALLOTMENT SYSTEM', 'ROUND I – GENERAL – ACCEPT AND UPWARD',  'ALLOTTED STUDENTS LIST'],
        govt:    ['TNEA ALLOTMENT SYSTEM', 'ROUND I – GOVERNMENT 7.5% – ACCEPT AND UPWARD', 'ALLOTTED STUDENTS LIST'],
      }
      const nameMap: Record<string, string> = { all: 'All_Students', general: 'General_Quota', govt: 'Govt_7_5_Quota' }
      const [l1, l2, l3] = labels[type]
      generateFormattedStudentReport(rows, `${nameMap[type]}_${new Date().toISOString().split('T')[0]}`, l1, l2, l3)
      setDone(type)
    } catch { alert('Failed to generate report') }
    finally { setGenerating('') }
  }

  const downloadZoneStudents = () => {
    if (!selectedZone) return
    setGenerating('zone_students')
    setDone('')
    try {
      const zoneName = zones.find(z => z.id === selectedZone)?.zone_name ?? ''
      const list = deduped.filter(s => s.zone_id === selectedZone)
      if (!list.length) { alert('No data found for this zone'); return }

      const rows = list.map(s => rowFromStudent(s, zoneName))
      generateFormattedStudentReport(
        rows,
        `Zone_${zoneName.replace(/\s/g, '_')}_Students_${new Date().toISOString().split('T')[0]}`,
        'TNEA ALLOTMENT SYSTEM',
        `ROUND I – ${zoneName.toUpperCase()} ZONE – ACCEPT AND UPWARD`,
        'ALLOTTED STUDENTS LIST'
      )
      setDone('zone_students')
    } catch { alert('Failed to generate report') }
    finally { setGenerating('') }
  }

  const downloadCollegeAssignment = () => {
    if (!selectedZone) return
    setGenerating('zone_colleges')
    setDone('')
    try {
      const zoneName = zones.find(z => z.id === selectedZone)?.zone_name ?? ''
      const list = deduped.filter(s => s.zone_id === selectedZone)
      if (!list.length) { alert('No data found for this zone'); return }

      generateCollegeAssignmentReport(
        list,
        zoneName,
        `Zone_${zoneName.replace(/\s/g, '_')}_College_Assignment_${new Date().toISOString().split('T')[0]}`
      )
      setDone('zone_colleges')
    } catch { alert('Failed to generate report') }
    finally { setGenerating('') }
  }

  const quickCards = [
    { id: 'all' as const,     label: 'All Students',    desc: 'Complete merged student list',        icon: FileSpreadsheet, color: 'blue' },
    { id: 'general' as const, label: 'General Quota',   desc: 'General quota students only',         icon: FileSpreadsheet, color: 'sky' },
    { id: 'govt' as const,    label: 'Govt 7.5% Quota', desc: 'Government 7.5% quota students',      icon: FileSpreadsheet, color: 'green' },
  ]

  const colorCls: Record<string, { card: string; icon: string }> = {
    blue:  { card: 'border-blue-100 hover:border-blue-400 hover:bg-blue-50',  icon: 'bg-blue-100 text-blue-600' },
    sky:   { card: 'border-sky-100 hover:border-sky-400 hover:bg-sky-50',     icon: 'bg-sky-100 text-sky-600' },
    green: { card: 'border-green-100 hover:border-green-400 hover:bg-green-50', icon: 'bg-green-100 text-green-600' },
  }

  const selectedZoneName = zones.find(z => z.id === selectedZone)?.zone_name ?? ''

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Download TNEA-formatted Excel reports by quota or zone ({students.length} students in session)</p>
      </div>

      {/* Quick Downloads */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Quick Downloads</h3>
        <p className="text-xs text-gray-400 mb-4">TNEA-formatted allotted students list with title headers and serial numbers</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickCards.map(card => {
            const cls = colorCls[card.color]
            const isGen = generating === card.id
            const isDone = done === card.id
            return (
              <button key={card.id} onClick={() => downloadStudentReport(card.id)}
                disabled={!!generating}
                className={`p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 ${cls.card}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${cls.icon}`}>
                  {isGen ? <Loader2 className="w-5 h-5 animate-spin" /> :
                   isDone ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                   <card.icon className="w-5 h-5" />}
                </div>
                <p className="font-medium text-sm text-gray-800">{card.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Zone-wise Reports */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Zone-wise Reports</h3>
        <p className="text-xs text-gray-400 mb-4">Select a counselling zone to download its reports</p>

        {/* Zone selector */}
        <div className="flex flex-wrap gap-2 mb-5">
          {zones.map(z => (
            <button key={z.id} onClick={() => { setSelectedZone(z.id); setDone('') }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                selectedZone === z.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}>
              {z.zone_name}
            </button>
          ))}
        </div>

        {/* Report buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Student List */}
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                {generating === 'zone_students'
                  ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  : done === 'zone_students'
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <FileSpreadsheet className="w-5 h-5 text-indigo-600" />}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">Student List</p>
                <p className="text-xs text-gray-400 mt-0.5">All students allotted to colleges in this zone</p>
              </div>
            </div>
            <button onClick={downloadZoneStudents} disabled={!selectedZone || !!generating}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" />
              {selectedZone ? `Download ${selectedZoneName} Students` : 'Select a zone first'}
            </button>
          </div>

          {/* College Assignment Report (Image 3 style) */}
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                {generating === 'zone_colleges'
                  ? <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  : done === 'zone_colleges'
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <Building2 className="w-5 h-5 text-amber-600" />}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">College Assignment Report</p>
                <p className="text-xs text-gray-400 mt-0.5">Colleges assigned with district and TFC nos.</p>
              </div>
            </div>
            <button onClick={downloadCollegeAssignment} disabled={!selectedZone || !!generating}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" />
              {selectedZone ? `Download ${selectedZoneName} Colleges` : 'Select a zone first'}
            </button>
          </div>
        </div>

        {(done === 'zone_students' || done === 'zone_colleges') && (
          <p className="mt-3 text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Downloaded — check your Downloads folder
          </p>
        )}
      </div>
    </div>
  )
}
