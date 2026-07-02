import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'
import { Users, MapPin, TrendingUp, BarChart3, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface ZoneStat { zone_name: string; count: number }
interface Stats { total: number; general: number; govt: number; zones: ZoneStat[] }

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6']

interface StatCard { label: string; value: number; icon: ReactNode; bg: string; num: string }

export function DashboardPage() {
  const { user } = useAuth()
  const { students } = useSession()
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // zones and college_zone_mapping are shared reference data, not
    // TFC-scoped, so they stay in Supabase. The zone_id stored on each
    // in-memory student maps to a zone name via this lookup.
    supabase.from('zones').select('id, zone_name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {}
        for (const z of data) map[z.id] = z.zone_name
        setZoneNames(map)
      }
      setLoading(false)
    })
  }, [])

  const stats: Stats = useMemo(() => {
    const counts: Record<string, number> = {}
    let general = 0, govt = 0
    for (const s of students) {
      if (s.quota_type === 'general') general++
      else if (s.quota_type === 'govt_7_5') govt++
      const name = (s.zone_id && zoneNames[s.zone_id]) || 'Unallocated'
      counts[name] = (counts[name] ?? 0) + 1
    }
    return {
      total: students.length,
      general,
      govt,
      zones: Object.entries(counts)
        .map(([zone_name, count]) => ({ zone_name, count }))
        .sort((a, b) => b.count - a.count),
    }
  }, [students, zoneNames])

  const quotaData = [
    { name: 'General', value: stats.general, color: '#3b82f6' },
    { name: 'Govt 7.5%', value: stats.govt, color: '#10b981' },
  ]

  const statCards: StatCard[] = [
    { label: 'Total Students', value: stats.total, icon: <Users className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', num: 'text-blue-700' },
    { label: 'General Quota', value: stats.general, icon: <TrendingUp className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50', num: 'text-indigo-700' },
    { label: 'Govt 7.5% Quota', value: stats.govt, icon: <BarChart3 className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', num: 'text-green-700' },
    { label: 'Active Zones', value: stats.zones.length, icon: <MapPin className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50', num: 'text-amber-700' },
  ]

  const refresh = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 400)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of student allotment data for TFC {user?.tfc_id}</p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>{c.icon}</div>
            </div>
            <p className={`text-3xl font-bold ${c.num}`}>{loading ? '-' : c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Zone-wise Distribution</h3>
          {stats.zones.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.zones} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="zone_name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              {loading ? 'Loading...' : 'Upload Excel files to see data here'}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Quota Distribution</h3>
          {(stats.general > 0 || stats.govt > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={quotaData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {quotaData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              {loading ? 'Loading...' : 'No data yet'}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Zone-wise Student Count</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left">Zone</th>
                <th className="px-6 py-3 text-right">Students</th>
                <th className="px-6 py-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.zones.map((z, i) => (
                <tr key={z.zone_name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium text-gray-800">{z.zone_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600">{z.count}</td>
                  <td className="px-6 py-3 text-right text-gray-600">
                    {stats.total > 0 ? ((z.count / stats.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              {stats.zones.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-400">No student data yet - upload Excel files on the Upload page</td></tr>
              )}
              {loading && (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-400">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
