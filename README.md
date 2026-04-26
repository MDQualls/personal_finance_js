# Personal Finance Tracker

A self-hosted, single-user personal finance dashboard. Track accounts, transactions, budgets, and subscriptions. Generate AI-powered spending insights via Claude. Fully Dockerized — runs locally with no external services beyond the Anthropic API.

---

## Features

- **Accounts** — track checking, savings, credit cards, loans, investments, and assets. Net worth calculated automatically.
- **Transactions** — add, edit, and soft-delete transactions. Filter by account, category, date range, tag, or search. Bulk import via CSV with automatic duplicate detection.
- **Budgets** — set monthly (or weekly/quarterly/yearly) spending limits per category. Color-coded progress bars. Optional rollover.
- **Subscriptions** — track recurring services with due-date alerts, monthly/annual cost totals, and status badges.
- **Calendar** — 30/60/90-day view of upcoming bills and subscription charges.
- **Reports** — spending by category (pie chart), monthly income vs. expense trends (bar chart), net worth over time (area chart). All charts filterable by date range.
- **Cash Flow** — projected daily balance for the next 30/60/90 days based on recurring rules and active subscriptions. Highlights days where balance dips below zero.
- **AI Insights** — on-demand Claude analysis of a selected month. Summarizes spending patterns, flags overspend categories, audits subscriptions, explains month-over-month changes, and generates actionable recommendations. Results cached per period.
- **Auto-Categorization Rules** — pattern-match rules applied automatically on transaction entry and CSV import.
- **Tags** — free-form labels for transactions, filterable across the transaction list and reports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials, JWT) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Forms | react-hook-form + Zod |
| Icons | Lucide React |
| Testing | Jest, Testing Library, jest-mock-extended |
| Runtime | Node.js 20 (Alpine Docker image) |

---

## Architecture

```
personal_finance_js/
  ├── app/
  │   ├── (dashboard)/          # Protected route group — session-gated
  │   │   ├── layout.tsx        # Session check → redirect to /auth/signin
  │   │   ├── dashboard/        # Home: net worth, budget summary, recent transactions
  │   │   ├── accounts/         # Account list and balance overview
  │   │   ├── transactions/     # Full transaction log + CSV import
  │   │   ├── budgets/          # Budget progress and management
  │   │   ├── subscriptions/    # Subscription tracker
  │   │   ├── calendar/         # Upcoming bills calendar
  │   │   ├── reports/          # Charts + AI insights
  │   │   ├── cashflow/         # Projected balance
  │   │   └── settings/         # Categories, tags, auto-rules
  │   ├── api/                  # Next.js route handlers (all auth-gated)
  │   │   ├── accounts/
  │   │   ├── transactions/
  │   │   ├── budgets/
  │   │   ├── subscriptions/
  │   │   ├── reports/          # spending, trends, net-worth, cashflow
  │   │   ├── insights/         # AI insight generation + cache retrieval
  │   │   ├── categories/
  │   │   ├── tags/
  │   │   ├── rules/            # Recurring rules for cash flow projection
  │   │   └── auto-rules/       # Auto-categorization rules
  │   └── auth/signin/          # Login page
  ├── components/
  │   ├── ui/                   # Button, Input, Modal, Badge, Card, BudgetProgress, TransactionRow, ...
  │   ├── charts/               # Recharts wrappers (Pie, Bar, Area, Line)
  │   ├── forms/                # AccountForm, TransactionForm, BudgetForm, SubscriptionForm
  │   └── layout/               # Sidebar, Header, SessionProvider
  ├── lib/
  │   ├── prisma.ts             # Prisma singleton
  │   ├── api.ts                # apiSuccess / apiError response helpers
  │   ├── money.ts              # toCents, toDollars, formatCurrency (all amounts stored as integer cents)
  │   ├── dates.ts              # date-fns wrappers for period math and formatting
  │   ├── anthropic.ts          # Anthropic client + prompt builder
  │   ├── auth.ts               # NextAuth config
  │   ├── rateLimit.ts          # In-memory token bucket (auth: 10/15min, insights: 20/hr)
  │   ├── alerts.ts             # Budget, subscription, and large-transaction alert logic
  │   ├── projection.ts         # Cash flow projection engine
  │   ├── reports.ts            # Server-side aggregation for report endpoints
  │   └── normalize.ts          # Merchant description normalization
  ├── prisma/
  │   ├── schema.prisma         # All models and enums
  │   └── seed.ts               # System categories
  ├── types/index.ts            # Shared TypeScript types
  ├── Dockerfile
  └── docker-compose.yml
```

### Key Design Decisions

**All monetary amounts are stored as integers (cents).** No floats in the database or business logic. `lib/money.ts` provides `toCents`, `toDollars`, and `formatCurrency`.

**Transactions are soft-deleted.** Setting `deletedAt` timestamp rather than hard deleting. All queries filter `deletedAt: null` by default.

**Server Components by default.** Pages fetch data server-side via Prisma. Only components that need browser APIs, state, or event handlers are marked `'use client'`.

**Every API route checks the session first**, before any input parsing or database access. There are no public endpoints.

**AI insights are pre-aggregated.** Raw transactions are never sent to the Claude API. The server aggregates category totals, budget utilization percentages, and subscription costs before building the prompt. Results are cached in the `AIInsight` table for 24 hours per period.

**Zod validates all POST/PATCH request bodies** before any database operation.

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- An Anthropic API key (for AI insights)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd personal_finance_js
cp .env.local.example .env.local
```

Edit `.env.local` and fill in all values. To generate a bcrypt password hash:

```bash
# Start the db container first, then run:
docker compose run --rm app node -e \
  'require("bcryptjs").hash("yourpassword", 12).then(h => console.log(Buffer.from(h).toString("base64")))'
```

Set the output as `AUTH_PASSWORD_HASH_B64` in `.env.local`.

### 2. Start the application

```bash
docker compose up --build -d
```

### 3. Run database migrations and seed

```bash
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npx prisma db seed
```

### 4. Open the app

Visit [http://localhost:3000](http://localhost:3000) and sign in with the credentials from your `.env.local`.

---

## Development Commands

```bash
# View logs
docker compose logs -f app

# Type check
docker compose exec app npx tsc --noEmit

# Lint
docker compose exec app npx eslint .

# Run tests
docker compose exec app npx jest

# Run tests with coverage
docker compose exec app npx jest --coverage

# Open Prisma Studio (database GUI)
docker compose exec app npx prisma studio

# Create a new migration after schema changes
docker compose exec app npx prisma migrate dev --name describe_your_change
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (`postgresql://user:pass@db:5432/finance`) |
| `NEXTAUTH_SECRET` | Random 32+ character string for session signing |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000`) |
| `AUTH_USERNAME` | Login username |
| `AUTH_PASSWORD_HASH_B64` | Base64-encoded bcrypt hash of the login password |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI insights |
| `POSTGRES_USER` | Postgres username (used by the db container) |
| `POSTGRES_PASSWORD` | Postgres password |
| `POSTGRES_DB` | Postgres database name |

---

## Data Model

```
Account ──< Transaction >── Category
                 │
                 └──< Tag (many-to-many)

Category ──< Budget
Category ──< Subscription
Category ──< RecurringRule

Account ──< RecurringRule

AIInsight (keyed by period, e.g. "2026-04")
AutoRule  (pattern → category mapping for import/entry)
MerchantRule (pattern → display name normalization)
```
