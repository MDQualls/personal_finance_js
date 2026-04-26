import type { AccountType, BudgetPeriod, Frequency, RecurringType } from '@prisma/client'

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Account = {
  id: string
  name: string
  type: AccountType
  balance: number // cents
  currency: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type Category = {
  id: string
  name: string
  parentId: string | null
  color: string
  icon: string
  isIncome: boolean
  isSystem: boolean
  isActive: boolean
  children?: Category[]
}

export type Transaction = {
  id: string
  accountId: string
  amount: number // cents
  date: Date
  categoryId: string
  description: string
  notes: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  category?: Category
  tags?: Tag[]
  account?: Account
}

export type Budget = {
  id: string
  categoryId: string
  amount: number // cents
  period: BudgetPeriod
  startDate: Date
  rollover: boolean
  createdAt: Date
  updatedAt: Date
  category?: Category
  spent?: number // cents — computed field
}

export type Subscription = {
  id: string
  name: string
  amount: number // cents
  frequency: Frequency
  nextDueDate: Date
  categoryId: string
  notes: string | null
  isActive: boolean
  alertDays: number
  createdAt: Date
  updatedAt: Date
  category?: Category
  monthlyEquivalent?: number // cents — computed field
}

export type RecurringRule = {
  id: string
  name: string
  amount: number // cents
  frequency: Frequency
  accountId: string
  categoryId: string
  nextDate: Date
  type: RecurringType
  createdAt: Date
  updatedAt: Date
  account?: Account
  category?: Category
}

export type Tag = {
  id: string
  name: string
  color: string
}

export type AIInsight = {
  id: string
  period: string
  prompt: string
  response: InsightResponse
  generatedAt: Date
}

export type AutoRule = {
  id: string
  pattern: string
  isRegex: boolean
  categoryId: string
  tagId: string | null
  priority: number
  createdAt: Date
  updatedAt: Date
}

export type MerchantRule = {
  id: string
  pattern: string
  isRegex: boolean
  displayName: string
  createdAt: Date
  updatedAt: Date
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export type InsightResponse = {
  summary: string
  overspendCategories: { name: string; budgeted: number; actual: number }[]
  subscriptionAudit: { name: string; flag: string }[]
  momDelta: { category: string; change: number; note: string }[]
  projection: { estimatedBalance: number; note: string }
  recommendations: string[]
}

// ─── Projection Types ─────────────────────────────────────────────────────────

export type DailyBalance = {
  date: string // ISO date string YYYY-MM-DD
  balance: number // cents
  belowZero: boolean
  events: ProjectionEvent[]
}

export type ProjectionEvent = {
  name: string
  amount: number // cents
  type: 'income' | 'expense' | 'subscription'
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export type SpendingByCategory = {
  categoryId: string
  categoryName: string
  color: string
  amount: number // cents
  percentage: number
}

export type MonthlyTrend = {
  month: string // "Apr 2026"
  income: number // cents
  expenses: number // cents
  net: number // cents
  byCategory: Record<string, number> // categoryName → cents
}

export type NetWorthSnapshot = {
  month: string
  assets: number // cents
  liabilities: number // cents
  netWorth: number // cents
}

// ─── Alert Types ──────────────────────────────────────────────────────────────

export type BudgetAlert = {
  type: 'budget_warning' | 'budget_over'
  budgetId: string
  categoryName: string
  spent: number // cents
  limit: number // cents
  percentage: number
}

export type SubscriptionAlert = {
  type: 'subscription_due'
  subscriptionId: string
  name: string
  amount: number // cents
  daysUntilDue: number
  dueDate: Date
}

export type LargeTransactionAlert = {
  type: 'large_transaction'
  transactionId: string
  description: string
  amount: number // cents
  threshold: number // cents
}

export type Alert = BudgetAlert | SubscriptionAlert | LargeTransactionAlert

// ─── CSV Import Types ─────────────────────────────────────────────────────────

export type CsvImportResult = {
  imported: number
  skipped: number
  duplicates: number
  errors: string[]
}

export type CsvRow = {
  date: string
  amount: string
  description: string
  [key: string]: string
}

// ─── API Response Helpers ─────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  data: T
  meta?: Record<string, unknown>
}

export type ApiError = {
  error: string | Record<string, unknown>
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
