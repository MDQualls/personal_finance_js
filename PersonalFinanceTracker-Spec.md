# Personal Finance Tracker — Technical Specification
**Version 1.0 | April 2026**

---

## Technology Stack at a Glance

| Layer | Technology |
|---|---|
| Framework | Next.js (fullstack — App Router + API Routes) |
| Language | TypeScript / Node.js |
| Database | PostgreSQL (Dockerized) |
| ORM | Prisma |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Auth | NextAuth.js |
| AI / Insights | Claude API (Anthropic) |
| Containerization | Docker + Docker Compose |

---

## 1. Project Structure

The application is a single Next.js project with the App Router. All API logic lives in Next.js route handlers under `/app/api`. Docker Compose orchestrates the app container and a Postgres container.

```
finance-tracker/
  ├── app/                   Next.js App Router pages & layouts
  │   ├── (dashboard)/       Protected route group
  │   ├── api/               API route handlers
  │   └── auth/              NextAuth pages
  ├── components/            Shared React components
  ├── lib/                   Prisma client, helpers, AI client
  ├── prisma/                schema.prisma + migrations
  ├── docker-compose.yml
  ├── Dockerfile
  └── .env.local
```

---

## 2. Docker & Infrastructure

### 2.1 Services

| Service | Image | Notes |
|---|---|---|
| app | Node 20 Alpine (custom) | Next.js on port 3000; hot-reload in dev |
| db | postgres:16-alpine | Port 5432; data persisted to named volume |

### 2.2 Environment Variables

- `DATABASE_URL` — Prisma connection string to Postgres container
- `NEXTAUTH_SECRET` — Random secret for session signing
- `NEXTAUTH_URL` — e.g. `http://localhost:3000`
- `ANTHROPIC_API_KEY` — Claude API key for AI insights
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — DB credentials

---

## 3. Authentication

NextAuth.js with the Credentials provider. Because this is a personal-use app, a single set of credentials (username + password) stored in environment variables is sufficient. Sessions are JWT-based and stored in an HTTP-only cookie.

**Key behaviors:**
- All routes under `/dashboard` require an active session
- Redirect to `/auth/signin` if unauthenticated
- Session expires after 30 days; sliding expiry on activity
- No registration flow — credentials are env-var only

---

## 4. Database Schema (Prisma)

All monetary values are stored as integers (cents) to avoid floating-point rounding errors. Enums are used for categories and frequencies to enforce consistency.

### 4.1 Core Models

| Model | Key Fields | Purpose |
|---|---|---|
| Account | id, name, type, balance (cents), currency, isActive | Checking, savings, credit card, loan, asset |
| Transaction | id, accountId, amount (cents), date, categoryId, description, notes, tags[] | Every debit/credit movement |
| Category | id, name, parentId, color, icon, isSystem | Hierarchical spend categories |
| Budget | id, categoryId, amount (cents), period, startDate | Spending limits per category |
| Subscription | id, name, amount (cents), frequency, nextDueDate, categoryId, notes, isActive | Recurring services and bills |
| RecurringRule | id, name, amount (cents), frequency, accountId, categoryId, nextDate, type | Predicted recurring cash flows |
| Tag | id, name, color | Free-form labels for transactions |
| AIInsight | id, prompt, response, generatedAt, period | Cached AI analysis results |

### 4.2 Enums

- `AccountType`: CHECKING | SAVINGS | CREDIT_CARD | LOAN | INVESTMENT | ASSET | LIABILITY
- `BudgetPeriod`: WEEKLY | MONTHLY | QUARTERLY | YEARLY
- `Frequency`: WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | YEARLY
- `RecurringType`: INCOME | EXPENSE

---

## 5. Feature Specifications

### 5.1 Core — Accounts & Transactions

#### Account Management
- Create / edit / archive accounts with name, type, currency, opening balance
- Manual balance entry — user updates balance directly; app tracks deltas
- Net worth widget on dashboard: sum of asset accounts minus liability accounts
- Account list view: sorted by type, showing current balance and last activity

#### Transaction Log
- Add transaction: amount, date, account, category, description, notes, tags
- Edit and soft-delete any transaction (deleted flag, not hard delete)
- Split transaction: divide one entry across multiple categories with sub-amounts
- Tag support: multi-tag per transaction, tag filter in transaction list
- Merchant normalization: user-defined rules to clean raw description strings (e.g. `AMZN*12345` → `Amazon`)
- Bulk import: paste or upload CSV; column-mapping wizard; duplicate detection by date + amount + description hash

#### Budget Management
- Create budgets per category per period (monthly default)
- Budget progress bar: spent / limit with color coding (green < 75%, amber 75–99%, red ≥ 100%)
- Rollover option per budget: unused amount carries to next period
- Budget vs. actual summary table on dashboard

---

### 5.2 Subscriptions & Recurring

#### Subscription Tracker
- Fields: name, amount, billing frequency, next due date, category, notes, active flag
- Status indicators: active (green), paused (amber), cancelled (gray)
- Monthly equivalent display for non-monthly subscriptions (e.g. annual plan ÷ 12)
- Total active subscriptions cost widget: monthly and annual totals

#### Recurring Bill Calendar
- Calendar view showing upcoming subscription and recurring rule due dates
- List view: next 30 / 60 / 90 days of upcoming bills
- Projected balance: running account balance forward using known recurring expenses and income

#### Alerts
- Due-date alert: N days before a subscription charges (configurable per subscription, default 3 days)
- Budget threshold alert: notified at 80% and 100% of any budget
- Large transaction alert: flag transactions above a configurable threshold
- Alerts surface as in-app notification badges; no email required for v1

---

### 5.3 Reporting & Insights

#### Standard Reports (Recharts)
- Spending by category: pie chart + ranked list for any date range
- Monthly spending trend: bar chart comparing current and prior 6 months by category
- Income vs. expense summary: grouped bar or waterfall chart per month
- Budget vs. actual: horizontal bar chart, one row per budget category
- Net worth over time: area chart (monthly snapshots stored on first of month)
- All reports: date range picker, category filter, export to CSV

#### AI Insights — Claude API

> **How it works:** On demand the user triggers an AI analysis for a selected period. The server aggregates spending totals by category, budget utilization, subscription costs, and income vs. expense figures — then sends a structured prompt to the Claude API. The response is stored in the `AIInsight` table and displayed as a formatted report. Results are cached per period so repeated requests do not burn tokens.

AI Insight report includes:
- Spending pattern summary: plain-language overview of where money went
- Top overspend categories: which budgets were exceeded and by how much
- Subscription audit: flags subscriptions that appear unused based on recurrence vs. spend category activity
- Month-over-month delta commentary: notable increases or decreases explained in plain English
- Forward-looking projection: estimated end-of-month balance given current pace
- Actionable recommendations: 3–5 concrete suggestions specific to the period's data

Prompt design principles:
- All data is pre-aggregated server-side before sending to Claude — no raw transactions in the prompt
- Structured JSON payload in the prompt; Claude instructed to return structured JSON response
- Response parsed and rendered as formatted card sections in the UI
- Model: `claude-sonnet-4-20250514`

---

### 5.4 Cash Flow

#### Projected Balance
- Forward-looking balance view for each account: 30 / 60 / 90 day windows
- Inputs: current balance + RecurringRule entries (income and expenses) + active subscriptions
- Chart: line chart showing daily projected balance; dips below zero highlighted in red
- Assumptions displayed: which rules were included, effective date

#### Income Tracking
- Income transactions are categorized with positive amounts (INCOME category type)
- Paycheck tracking: recurring income rules auto-project future pay deposits
- Income vs. expense ratio widget on dashboard

---

### 5.5 Organization

#### Categories
- Two-level hierarchy: parent category (e.g. Food) and subcategory (e.g. Groceries, Dining Out)
- System categories pre-seeded on first run; user can add custom categories
- Each category: name, parent, color (hex), icon (emoji or icon key), isIncome flag
- Categories cannot be deleted if transactions reference them — only archived

#### Tags
- Free-form labels applied to any transaction (multi-tag supported)
- Tag management screen: create, rename, merge, delete tags
- Tag filter on transaction list and reports

#### Auto-Categorization Rules
- User creates rules: if description contains [string] → assign category + optional tag
- Rules applied automatically on new transaction entry and on CSV import
- Rule priority: first match wins; drag-to-reorder rule list

#### Notes & Merchant Normalization
- Free-text notes field on every transaction
- Merchant normalization: pattern → display name mapping (contains match or regex)
- Normalized merchant name shown in transaction list; raw description preserved

---

## 6. API Route Design

All routes are Next.js App Router Route Handlers under `/app/api/`. All endpoints are protected by NextAuth session middleware. Responses follow a consistent `{ data, error, meta }` envelope.

| Method | Route | Purpose |
|---|---|---|
| GET | /api/accounts | List all accounts with current balance |
| POST | /api/accounts | Create account |
| PATCH | /api/accounts/[id] | Update account or balance |
| GET | /api/transactions | List transactions (filters: account, category, tag, date range, search) |
| POST | /api/transactions | Create single transaction |
| POST | /api/transactions/import | Bulk CSV import with duplicate detection |
| PATCH | /api/transactions/[id] | Edit transaction |
| DELETE | /api/transactions/[id] | Soft delete transaction |
| GET | /api/budgets | List budgets with current period spend |
| POST | /api/budgets | Create budget |
| GET | /api/subscriptions | List subscriptions |
| POST | /api/subscriptions | Create subscription |
| PATCH | /api/subscriptions/[id] | Update subscription |
| GET | /api/reports/spending | Spending by category for date range |
| GET | /api/reports/trends | Month-over-month trend data |
| GET | /api/reports/cashflow | Projected balance data |
| POST | /api/insights/generate | Trigger Claude AI insight for a period |
| GET | /api/insights/[period] | Retrieve cached insight for period |
| GET | /api/categories | List categories |
| GET | /api/tags | List tags |
| GET | /api/rules | List auto-categorization rules |
| POST | /api/rules | Create rule |

---

## 7. UI Pages & Navigation

| Route | Page / Purpose |
|---|---|
| /dashboard | Home: net worth widget, budget summary, upcoming bills, recent transactions |
| /accounts | Account list and balance overview |
| /transactions | Full transaction log with filter/search bar |
| /transactions/new | Add transaction form |
| /transactions/import | CSV import wizard |
| /budgets | Budget management and progress view |
| /subscriptions | Subscription tracker and monthly total |
| /calendar | Recurring bill calendar (30/60/90 day view) |
| /reports | Reporting hub: spending, trends, income vs. expense, net worth |
| /reports/insights | AI Insights: generate and view Claude analysis |
| /cashflow | Projected balance charts per account |
| /settings/categories | Manage categories and subcategories |
| /settings/tags | Manage tags |
| /settings/rules | Auto-categorization and merchant normalization rules |

---

## 8. Suggested Build Phases

| Phase | Focus | Deliverable |
|---|---|---|
| 1 | Foundation | Docker Compose, Postgres, Prisma schema, NextAuth, base layout |
| 2 | Core Data | Accounts, Categories, Transactions CRUD, CSV import |
| 3 | Budgets & Subscriptions | Budget engine, subscription tracker, due-date alerts |
| 4 | Reports | Recharts dashboards: spending, trends, income vs. expense, net worth |
| 5 | Cash Flow | Recurring rules engine, projected balance chart |
| 6 | AI Insights | Claude API integration, prompt design, insight UI |
| 7 | Polish | Tags, rules, merchant normalization, notification badges, mobile responsiveness |

---

*End of Specification — v1.0*
