import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export interface RawStudentData {
  'TFC No.': string
  'APPLICATION NO.': string
  'Name': string
  'Final college code'?: string
  'College name'?: string
  'Branch Code'?: string
  [key: string]: string | number | undefined
}

export interface ProcessedStudent {
  application_no: string
  name: string
  tfc_no: string
  final_college_code: string
  college_name: string
  branch_code: string
  quota_type: 'general' | 'govt_7_5'
  zone_id: string | null
}

// Real-world TNEA files have multiple column name variants/typos
const APP_NO_TOKENS = ['application no', 'applcation no', 'appln. no', 'appln no', 'appl. no', 'appl no']

export function parseExcelFile(file: File): Promise<RawStudentData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const allData: RawStudentData[] = []

        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName]
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

          let headerRowIndex = -1
          for (let i = 0; i < Math.min(rawData.length, 15); i++) {
            const row = rawData[i]
            const rowStr = row.map(cell => String(cell ?? '').toLowerCase()).join('|')
            const hasAppNo = APP_NO_TOKENS.some(t => rowStr.includes(t))
            if (hasAppNo && rowStr.includes('name')) {
              headerRowIndex = i
              break
            }
          }

          if (headerRowIndex === -1) continue

          const headers = rawData[headerRowIndex].map(h => String(h ?? '').trim())
          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i]
            if (row.every(cell => !cell)) continue
            const obj: Record<string, string | number | undefined> = {}
            headers.forEach((h, idx) => { obj[h] = row[idx] as string | number | undefined })
            allData.push(obj as RawStudentData)
          }
        }

        resolve(allData)
      } catch { reject(new Error('Failed to parse file')) }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function findColumn(row: RawStudentData, patterns: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === pattern.toLowerCase().replace(/[^a-z0-9]/g, ''))
    if (found) return found
  }
  return undefined
}

// All known application number column variants across TNEA file formats
const APP_NO_PATTERNS = [
  'application no', 'application no.', 'applicationno',
  'applcation no', 'applcation no.', 'applcationno',   // typo in older files
  'appln no', 'appln. no', 'appln.no', 'applnno',       // abbreviated
  'appl no', 'appl. no', 'applno',
]

export function validateStudentData(data: RawStudentData[]): { valid: boolean; errors: string[] } {
  if (!data.length) return { valid: false, errors: ['File is empty'] }
  const errors: string[] = []
  const requiredColumns = [
    { patterns: APP_NO_PATTERNS, name: 'APPLICATION NO.' },
    { patterns: ['name', 'student name'], name: 'Name' },
  ]
  for (const { patterns, name } of requiredColumns) {
    if (!findColumn(data[0], patterns)) errors.push(`Missing column: ${name}`)
  }
  return { valid: errors.length === 0, errors }
}

function getColumnValue(row: RawStudentData, patterns: string[]): string {
  const key = findColumn(row, patterns)
  return key ? (row[key]?.toString() ?? '') : ''
}

function classifyQuota(row: RawStudentData): 'general' | 'govt_7_5' {
  const key = Object.keys(row).find(k => k.toLowerCase().includes('quota') || k.toLowerCase().includes('category'))
  if (key) {
    const v = String(row[key]).toLowerCase()
    if (v.includes('govt') || v.includes('7.5') || v === 'g') return 'govt_7_5'
  }
  return 'general'
}

function deriveZoneCode(collegeName: string): string | null {
  const n = collegeName.toLowerCase()
  if (n.includes('chennai') || n.includes('guindy') || n.includes('kancheepuram') ||
      n.includes('kanchipuram') || n.includes('thiruvallur') || n.includes('chengalpattu') ||
      n.includes('tambaram')) return 'CHN'
  if (n.includes('coimbatore') || n.includes('pollachi') || n.includes('tiruppur')) return 'CBE'
  if (n.includes('erode') || n.includes('sathyamangalam') || n.includes('bhavani')) return 'ERD'
  if (n.includes('salem') || n.includes('namakkal') || n.includes('dharmapuri') || n.includes('krishnagiri')) return 'SLM'
  if (n.includes('vellore') || n.includes('tiruvannamalai') || n.includes('ranipet')) return 'VEL'
  if (n.includes('madurai') || n.includes('virudhunagar') || n.includes('theni') || n.includes('sivaganga')) return 'MDU'
  if (n.includes('tirunelveli') || n.includes('nellai')) return 'TEN'
  if (n.includes('thoothukudi') || n.includes('tuticorin')) return 'TKD'
  if (n.includes('tiruchirappalli') || n.includes('trichy') || n.includes('tiruchirapalli') || n.includes('srirangam')) return 'TRC'
  if (n.includes('thanjavur') || n.includes('kumbakonam') || n.includes('nagapattinam') || n.includes('mayiladuthurai')) return 'TJV'
  if (n.includes('dindigul')) return 'DGL'
  return null
}

function extractDistrict(collegeName: string): string {
  const pairs: [string, string][] = [
    ['Chennai', 'Chennai'], ['Kancheepuram', 'Kancheepuram'], ['Thiruvallur', 'Thiruvallur'],
    ['Chengalpattu', 'Chengalpattu'], ['Coimbatore', 'Coimbatore'], ['Tiruppur', 'Tiruppur'],
    ['Pollachi', 'Coimbatore'], ['Erode', 'Erode'], ['Sathyamangalam', 'Erode'],
    ['Bhavani', 'Erode'], ['Salem', 'Salem'], ['Namakkal', 'Namakkal'],
    ['Dharmapuri', 'Dharmapuri'], ['Krishnagiri', 'Krishnagiri'], ['Vellore', 'Vellore'],
    ['Tiruvannamalai', 'Tiruvannamalai'], ['Ranipet', 'Ranipet'], ['Madurai', 'Madurai'],
    ['Virudhunagar', 'Virudhunagar'], ['Theni', 'Theni'], ['Sivaganga', 'Sivaganga'],
    ['Tirunelveli', 'Tirunelveli'], ['Thoothukudi', 'Thoothukudi'], ['Tuticorin', 'Thoothukudi'],
    ['Tiruchirappalli', 'Tiruchirappalli'], ['Trichy', 'Tiruchirappalli'],
    ['Srirangam', 'Tiruchirappalli'], ['Thanjavur', 'Thanjavur'], ['Kumbakonam', 'Thanjavur'],
    ['Nagapattinam', 'Nagapattinam'], ['Mayiladuthurai', 'Mayiladuthurai'],
    ['Dindigul', 'Dindigul'], ['Karaikudi', 'Sivaganga'], ['Ariyalur', 'Ariyalur'],
    ['Cuddalore', 'Cuddalore'], ['Perambalur', 'Perambalur'],
  ]
  for (const [keyword, district] of pairs) {
    if (collegeName.toLowerCase().includes(keyword.toLowerCase())) return district
  }
  return ''
}

export async function processStudentData(
  data: RawStudentData[],
  tfcId: string
): Promise<{ processed: ProcessedStudent[]; errors: string[] }> {
  const errors: string[] = []
  const zoneCache: Record<string, string | null> = {}
  const processed: ProcessedStudent[] = []

  const { data: zonesData } = await supabase.from('zones').select('id, zone_code')
  const zoneCodeToId: Record<string, string> = {}
  for (const z of zonesData ?? []) zoneCodeToId[z.zone_code] = z.id

  for (const row of data) {
    try {
      const collegeCode = getColumnValue(row, ['final college code', 'final_college_code', 'collegecode'])
      const collegeName = getColumnValue(row, ['college name', 'college_name', 'collegename'])
      let zoneId: string | null = null

      if (collegeCode) {
        if (collegeCode in zoneCache) {
          zoneId = zoneCache[collegeCode]
        } else {
          const { data: m } = await supabase
            .from('college_zone_mapping')
            .select('zone_id')
            .eq('college_code', collegeCode)
            .maybeSingle()
          zoneId = m?.zone_id ?? null

          if (!zoneId && collegeName) {
            const zoneCode = deriveZoneCode(collegeName)
            if (zoneCode && zoneCodeToId[zoneCode]) {
              zoneId = zoneCodeToId[zoneCode]
              await supabase.from('college_zone_mapping').upsert(
                { college_code: collegeCode, college_name: collegeName, zone_id: zoneId },
                { onConflict: 'college_code' }
              )
            }
          }
          zoneCache[collegeCode] = zoneId
        }
      }

      processed.push({
        application_no: getColumnValue(row, APP_NO_PATTERNS),
        name: getColumnValue(row, ['name', 'student name']),
        // Requirement #1: every record belongs to the logged-in TFC,
        // regardless of what TFC number the Excel file itself contains.
        tfc_no: tfcId,
        final_college_code: collegeCode,
        college_name: collegeName,
        branch_code: getColumnValue(row, ['branch code', 'branch_code', 'branchcode']),
        quota_type: classifyQuota(row),
        zone_id: zoneId,
      })
    } catch {
      errors.push(`Failed to process: ${getColumnValue(row, APP_NO_PATTERNS)}`)
    }
  }
  return { processed, errors }
}

// Generates a formatted TNEA-style student list Excel (matches Images 1 & 2 style)
export function generateFormattedStudentReport(
  rows: Array<Record<string, unknown>>,
  fileName: string,
  line1: string,
  line2: string,
  line3: string
) {
  const headers = ['S.No.', 'TFC No.', 'Application No.', 'Name', 'Final College Code', 'College Name', 'Branch Code', 'Quota', 'Zone']
  const numCols = headers.length

  const aoa: unknown[][] = [
    [line1],
    [line2],
    [line3],
    headers,
    ...rows.map((r, i) => [
      i + 1,
      r['TFC No'],
      r['Application No'],
      r['Name'],
      r['College Code'],
      r['College Name'],
      r['Branch Code'],
      r['Quota'],
      r['Zone'],
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
  ]

  ws['!cols'] = [
    { wch: 7 }, { wch: 8 }, { wch: 14 }, { wch: 26 },
    { wch: 13 }, { wch: 62 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Allotted Students List')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

// Requirement #3: before generating the final Excel, ensure each student
// is assigned to exactly one TFC number. Deduplicate by application_no,
// keeping the first record (which already carries the logged-in TFC).
export function deduplicateStudents(students: ProcessedStudent[]): ProcessedStudent[] {
  const seen = new Map<string, ProcessedStudent>()
  for (const s of students) {
    if (!s.application_no) continue
    if (!seen.has(s.application_no)) seen.set(s.application_no, s)
  }
  return [...seen.values()]
}

// Generates a college assignment report (matches Image 3 style) from the
// in-memory student list (TFC-scoped session data).
export function generateCollegeAssignmentReport(
  students: ProcessedStudent[],
  zoneName: string,
  fileName: string
) {
  const filtered = students.filter(s => s.final_college_code)
  if (!filtered.length) return

  // Aggregate by college code
  const collegeMap = new Map<string, { name: string; tfcs: Set<string> }>()
  for (const s of filtered) {
    if (!collegeMap.has(s.final_college_code)) {
      collegeMap.set(s.final_college_code, { name: s.college_name, tfcs: new Set() })
    }
    if (s.tfc_no) collegeMap.get(s.final_college_code)!.tfcs.add(s.tfc_no)
  }

  const allTfcs = [...new Set(filtered.map(s => s.tfc_no).filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b))
    .join(', ')

  const sortedColleges = [...collegeMap.entries()].sort((a, b) => {
    const na = Number(a[0]), nb = Number(b[0])
    return isNaN(na) || isNaN(nb) ? a[0].localeCompare(b[0]) : na - nb
  })

  const numCols = 5
  const aoa: unknown[][] = [
    [`Nodal Center Zone : ${zoneName}`],
    [`TFCs Assigned : ${allTfcs}`],
    [`List of Colleges Assigned (${sortedColleges.length} Colleges)`],
    ['SL.No.', 'College Code', 'District', 'College Name', 'TFC Nos.'],
    ...sortedColleges.map(([code, info], i) => [
      i + 1,
      code,
      extractDistrict(info.name),
      info.name,
      [...info.tfcs].sort((a, b) => Number(a) - Number(b)).join(', '),
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
  ]

  ws['!cols'] = [
    { wch: 7 }, { wch: 14 }, { wch: 18 }, { wch: 70 }, { wch: 20 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'College List')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

export async function generateExcelReport(data: Record<string, unknown>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}
