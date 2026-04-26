'use client'

import { useState, useEffect } from 'react'
import { Sparkles, TrendingDown, CreditCard, BarChart2, Target, Lightbulb, RefreshCw } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/money'
import type { InsightResponse } from '@/types'

type InsightData = {
  period: string
  response: InsightResponse
  generatedAt: string
  cached: boolean
}

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7) // "YYYY-MM"

export default function InsightsPage() {
  const [period, setPeriod] = useState(CURRENT_PERIOD)
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setInsight(null)
    setError('')
    fetch(`/api/insights/${period}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.data) setInsight(body.data)
      })
      .finally(() => setLoading(false))
  }, [period])

  async function generate() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/insights/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
    })
    const body = await res.json()
    setGenerating(false)
    if (!res.ok) {
      setError(typeof body.error === 'string' ? body.error : 'Failed to generate insights.')
      return
    }
    setInsight(body.data)
  }

  const data = insight?.response

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium font-heading text-[#6b7a8d]">Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] outline-none focus:border-[#00b89c]"
          />
        </div>
        <Button onClick={generate} loading={generating}>
          <Sparkles size={14} strokeWidth={1.5} />
          {insight ? 'Regenerate' : 'Generate Insights'}
        </Button>
        {insight?.cached && (
          <span className="text-[12px] text-[#6b7a8d]">
            Cached · {new Date(insight.generatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-[8px] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#ef4444]">{error}</div>
      )}

      {loading && <div className="flex justify-center py-16"><Spinner size={32} /></div>}

      {!loading && !insight && !generating && (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="h-12 w-12 rounded-[12px] bg-[#e6f7f5] flex items-center justify-center mb-4">
              <Sparkles size={24} strokeWidth={1.5} className="text-[#00b89c]" />
            </div>
            <p className="text-[16px] font-semibold font-heading text-[#1a2332] mb-1">No insights yet</p>
            <p className="text-[13px] text-[#6b7a8d] mb-5">
              Generate an AI analysis of your spending for {period}.
            </p>
            <Button onClick={generate} loading={generating}>
              <Sparkles size={14} strokeWidth={1.5} />
              Generate Insights
            </Button>
          </div>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-[8px] bg-[#e6f7f5] flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart2 size={16} strokeWidth={1.5} className="text-[#00b89c]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold font-heading text-[#1a2332] mb-2">Summary</h3>
                <p className="text-[14px] text-[#6b7a8d] leading-relaxed">{data.summary}</p>
              </div>
            </div>
          </Card>

          {/* Overspend */}
          {data.overspendCategories.length > 0 && (
            <Card>
              <CardHeader
                title="Over Budget"
                action={<TrendingDown size={18} strokeWidth={1.5} className="text-[#ef4444]" />}
              />
              <div className="space-y-3">
                {data.overspendCategories.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[14px] text-[#1a2332]">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] text-[#6b7a8d]">Budget: {formatCurrency(item.budgeted)}</span>
                      <Badge variant="over-budget">Actual: {formatCurrency(item.actual)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Subscription audit */}
          {data.subscriptionAudit.length > 0 && (
            <Card>
              <CardHeader
                title="Subscription Audit"
                action={<CreditCard size={18} strokeWidth={1.5} className="text-[#f59e0b]" />}
              />
              <div className="space-y-3">
                {data.subscriptionAudit.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <span className="text-[14px] font-medium text-[#1a2332]">{item.name}</span>
                    <span className="text-[13px] text-[#6b7a8d] text-right">{item.flag}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* MoM delta */}
          {data.momDelta.length > 0 && (
            <Card>
              <CardHeader title="Month-over-Month Changes" />
              <div className="space-y-3">
                {data.momDelta.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[14px] font-medium text-[#1a2332]">{item.category}</span>
                      <span className={`text-[13px] font-semibold font-tabular ${item.change > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                        {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#6b7a8d]">{item.note}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Projection */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-[8px] bg-[#e6f7f5] flex items-center justify-center flex-shrink-0">
                <Target size={16} strokeWidth={1.5} className="text-[#00b89c]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold font-heading text-[#1a2332] mb-1">Forward Projection</h3>
                <p className="text-[22px] font-semibold font-tabular text-[#1a2332]">
                  {formatCurrency(data.projection.estimatedBalance)}
                </p>
                <p className="text-[13px] text-[#6b7a8d] mt-1">{data.projection.note}</p>
              </div>
            </div>
          </Card>

          {/* Recommendations */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-[8px] bg-[#e6f7f5] flex items-center justify-center flex-shrink-0">
                <Lightbulb size={16} strokeWidth={1.5} className="text-[#00b89c]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold font-heading text-[#1a2332] mb-3">Recommendations</h3>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[14px] text-[#6b7a8d]">
                      <span className="text-[#00b89c] font-semibold mt-0.5">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
