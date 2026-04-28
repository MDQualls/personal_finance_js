'use client'

import { useState, useEffect } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useRouter } from 'next/navigation'

type ImportResult = {
  imported: number
  duplicates: number
  skipped: number
  errors: string[]
}

type ParsedRow = {
  date: string
  amount: string
  description: string
  accountId: string
}

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((b) => setAccounts(b.data ?? []))
  }, [])

  function parseCSV(text: string): { date: string; amount: string; description: string }[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
    const dateIdx = headers.findIndex((h) => h.includes('date'))
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('debit') || h.includes('credit'))
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('merchant') || h.includes('payee') || h.includes('name'))

    if (dateIdx < 0 || amountIdx < 0 || descIdx < 0) return []

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''))
      return { date: cols[dateIdx], amount: cols[amountIdx], description: cols[descIdx] }
    }).filter((r) => r.date && r.amount && r.description)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('Could not parse CSV. Ensure it has date, amount, and description columns.')
        return
      }
      setPreview(rows.map((r) => ({ ...r, accountId })))
      setStep('preview')
    }
    reader.readAsText(f)
  }

  async function handleImport() {
    if (!accountId) { setError('Select an account first'); return }
    setLoading(true)

    const rows = preview.map((r) => ({ ...r, accountId }))
    const res = await fetch('/api/transactions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })

    const body = await res.json()
    setLoading(false)

    if (!res.ok) { setError('Import failed.'); return }
    setResult(body.data)
    setStep('done')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader title="Import Transactions" subtitle="Upload a CSV file to bulk-import transactions" />

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">
                Account
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-[14px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-[#e8ecf0] rounded-[12px] p-10 text-center hover:border-[#00b89c] hover:bg-[#e6f7f5] transition-colors">
                <Upload size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[#6b7a8d]" />
                <p className="text-[14px] font-medium text-[#1a2332]">Click to upload CSV</p>
                <p className="text-[12px] text-[#6b7a8d] mt-1">Must include date, amount, and description columns</p>
              </div>
              <input type="file" accept=".csv" className="sr-only" onChange={handleFile} />
            </label>

            {error && <p className="text-[13px] text-[#ef4444]">{error}</p>}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#6b7a8d]">{preview.length} rows found</p>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>Back</Button>
            </div>

            <div className="border border-[#e8ecf0] rounded-[8px] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-[#f4f6f9]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-[#6b7a8d]">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-[#6b7a8d]">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-[#6b7a8d]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8ecf0]">
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-[#6b7a8d]">{row.date}</td>
                      <td className="px-3 py-2 text-[#1a2332]">{row.description}</td>
                      <td className="px-3 py-2 text-right font-tabular text-[#1a2332]">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <div className="px-3 py-2 bg-[#f4f6f9] text-[12px] text-[#6b7a8d]">
                  …and {preview.length - 10} more rows
                </div>
              )}
            </div>

            {error && <p className="text-[13px] text-[#ef4444]">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setStep('upload')}>Cancel</Button>
              <Button loading={loading} onClick={handleImport}>
                Import {preview.length} Rows
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-[8px] bg-[#e6f7f5] p-4">
              <CheckCircle size={20} strokeWidth={1.5} className="text-[#00b89c] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-medium text-[#1a2332]">Import complete</p>
                <ul className="text-[13px] text-[#6b7a8d] mt-1 space-y-0.5">
                  <li>{result.imported} transactions imported</li>
                  <li>{result.duplicates} duplicates skipped</li>
                  {result.errors.length > 0 && (
                    <li className="text-[#ef4444]">{result.errors.length} rows had errors</li>
                  )}
                </ul>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-[8px] bg-[#fef2f2] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} strokeWidth={1.5} className="text-[#ef4444]" />
                  <p className="text-[13px] font-medium text-[#ef4444]">Errors</p>
                </div>
                <ul className="text-[12px] text-[#ef4444] space-y-0.5">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => router.push('/transactions')}>View Transactions</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
