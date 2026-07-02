import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Lock, User, AlertCircle, FileSpreadsheet } from 'lucide-react'

const TFC_IDS = ['TFC20', 'TFC21', 'TFC30', 'TFC70', 'TFC71', 'TFC73']

export function LoginPage() {
  const { login } = useAuth()
  const [tfcId, setTfcId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(tfcId, password)
    if (!result.success) { setError(result.error || 'Login failed'); setLoading(false) }
  }

  const autofill = (id: string) => { setTfcId(id); setPassword(id); setError('') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <FileSpreadsheet className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TNEA System</h1>
          <p className="text-gray-500 mt-1 text-sm">Zone-wise Student Allocation</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">TFC Centre Login</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">TFC ID</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={tfcId} onChange={e => setTfcId(e.target.value)}
                  placeholder="e.g. TFC20" required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2">Quick login — click to auto-fill</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {TFC_IDS.map(id => (
                <button key={id} type="button" onClick={() => autofill(id)}
                  className="px-3 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full border border-blue-200 transition-colors font-medium">
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
