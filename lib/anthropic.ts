import Anthropic from '@anthropic-ai/sdk'

const globalForAnthropic = globalThis as unknown as { anthropic: Anthropic }

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic

export type InsightResponse = {
  summary: string
  overspendCategories: { name: string; budgeted: number; actual: number }[]
  subscriptionAudit: { name: string; flag: string }[]
  momDelta: { category: string; change: number; note: string }[]
  projection: { estimatedBalance: number; note: string }
  recommendations: string[]
}

type AggregatedInsightData = {
  period: string
  categoryTotals: { name: string; amount: number; budgeted: number | null }[]
  subscriptionCosts: { name: string; amount: number; frequency: string; isActive: boolean }[]
  totalIncome: number
  totalExpenses: number
  currentBalance: number
  priorPeriodCategoryTotals: { name: string; amount: number }[]
}

export function buildInsightPrompt(data: AggregatedInsightData): string {
  return `You are a personal finance advisor analyzing spending data for ${data.period}.

Here is the aggregated financial summary (all amounts in cents):
${JSON.stringify(data, null, 2)}

Analyze this data and return a JSON object with EXACTLY this structure (no other text, only valid JSON):
{
  "summary": "2-3 sentence plain English overview of spending patterns",
  "overspendCategories": [
    { "name": "category name", "budgeted": 0, "actual": 0 }
  ],
  "subscriptionAudit": [
    { "name": "subscription name", "flag": "reason this subscription may be worth reviewing" }
  ],
  "momDelta": [
    { "category": "category name", "change": 0, "note": "plain English explanation" }
  ],
  "projection": {
    "estimatedBalance": 0,
    "note": "1 sentence explaining the projection"
  },
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ]
}

Rules:
- overspendCategories: only include categories where actual > budgeted (budgeted must be set)
- subscriptionAudit: flag subscriptions that appear unused or worth reviewing; omit healthy ones
- momDelta: only include categories with notable change (>15% or >$20)
- recommendations: 3-5 concrete, specific suggestions based on this data
- All amounts in your response should be in cents (integers)
- Return ONLY the JSON object, no markdown fences, no explanation`
}
