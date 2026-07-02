import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import type { ProcessedStudent } from '../lib/dataProcessing'

interface UploadRecord {
  fileName: string
  records: number
  errors: string[]
  uploadedAt: string
}

interface SessionState {
  students: ProcessedStudent[]
  uploads: UploadRecord[]
}

const EMPTY: SessionState = { students: [], uploads: [] }

interface SessionContextType {
  tfcId: string | null
  students: ProcessedStudent[]
  uploads: UploadRecord[]
  addUpload: (fileName: string, records: number, errors: string[]) => void
  setStudents: (students: ProcessedStudent[]) => void
  reset: () => void
}

const SessionContext = createContext<SessionContextType | null>(null)

// In-memory only: never persisted to localStorage. A page refresh
// remounts the app and recreates this provider, so all counts and
// statistics return to 0 and the user starts from the first step
// again (requirement #2). When the active TFC changes the store is
// wiped so data from one TFC is never visible to another (requirement #1).
export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const activeTfcRef = useRef<string | null>(null)
  const [state, setState] = useState<SessionState>(EMPTY)

  const currentTfc = user?.tfc_id ?? null

  // Clear the store when the active TFC changes (login, switch user, or
  // logout). Done in an effect rather than during render so it is safe
  // under React StrictMode double-invocation.
  useEffect(() => {
    if (currentTfc !== activeTfcRef.current) {
      activeTfcRef.current = currentTfc
      setState(EMPTY)
    }
  }, [currentTfc])

  const value = useMemo<SessionContextType>(() => ({
    tfcId: currentTfc,
    students: state.students,
    uploads: state.uploads,
    addUpload: (fileName, records, errors) =>
      setState(prev => ({
        ...prev,
        uploads: [
          ...prev.uploads,
          { fileName, records, errors, uploadedAt: new Date().toISOString() },
        ],
      })),
    setStudents: (students) =>
      setState(prev => ({ ...prev, students })),
    reset: () => setState(EMPTY),
  }), [currentTfc, state])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
