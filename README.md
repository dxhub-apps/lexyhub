# LexyHub

> The central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating market intelligence across multiple e-commerce marketplaces.

[![CI](https://github.com/dxhub-apps/lexyhub/actions/workflows/ci.yml/badge.svg)](https://github.com/dxhub-apps/lexyhub/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue)](./LICENSE)

**LexyHub** is an AI-powered cross-marketplace commerce intelligence platform designed for e-commerce businesses selling on Etsy, Amazon, and other online marketplaces. It provides keyword discovery, trend analysis, market simulation, and listing optimization tools to help sellers understand market dynamics and maximize their revenue.

## ✨ Features

### 🔑 **Keyword Workspace**
- Unified `/search` landing experience with autosuggest powered by `public.keywords`
- Deterministic scoring for volume, competition, and momentum
- Right-hand LexyBrain insight panel for immediate reasoning
- Keyboard shortcuts (`/`, `↑`, `↓`, `Enter`) for fast navigation

### 🧠 **LexyBrain Orchestration**
- All AI requests route through the LexyBrain orchestration API with `LEXYBRAIN_RAG_MODEL_ID`
- Consistent summaries, metrics, and risk analysis across search, keyword journeys, and reports
- Ask LexyBrain terminal interface for free-form market questions

### ⭐ **Watchlist**
- Minimal cards showing tracked keywords and core metrics
- Quick links into the keyword journey and Ask LexyBrain context

### 📈 **Keyword Journey**
- `/keyword/[id]` mirrors the search insight panel with full-screen tabs
- LexyBrain insights, sparkline trends, risk summary, and comparison entry points

### 🗒️ **Reports**
- Weekly and monthly LexyBrain briefs via the `market_brief` capability
- Top niches, keyword deltas, and risk summary surfaced in a monochrome table layout

## 🏗️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript 5.4](https://www.typescriptlang.org/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + pgvector)
- **AI/ML**: [OpenAI API](https://openai.com/), [Vercel AI SDK](https://sdk.vercel.ai/)
- **Authentication**: Supabase Auth + OAuth (Etsy, Amazon)
- **Scraping**: [Playwright](https://playwright.dev/)
- **Payments**: [Stripe](https://stripe.com/)
- **Deployment**: [Vercel](https://vercel.com/)
- **CI/CD**: GitHub Actions
- **Testing**: Vitest, Playwright Test

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** 10+
- **Supabase** account ([Sign up](https://supabase.com/))
- **OpenAI** API key ([Get one](https://platform.openai.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dxhub-apps/lexyhub.git
   cd lexyhub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and configure:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # OpenAI
   OPENAI_API_KEY=your-openai-api-key

   # Etsy (optional)
   ETSY_CLIENT_ID=your-etsy-client-id
   ETSY_CLIENT_SECRET=your-etsy-client-secret

   # Stripe (optional)
   STRIPE_SECRET_KEY=your-stripe-secret-key
   ```

4. **Set up the database**
   ```bash
   cd supabase
   npm run db:migrate
   ```

5. **Seed the database (optional)**
   ```bash
   npm run db:seed
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

- **[User Documentation](./docs/user-documentation.md)** - Complete feature guide
- **[Architecture](./ARCHITECTURE.md)** - System design and architecture
- **[Contributing](./CONTRIBUTING.md)** - Development guidelines
- **[Environment Setup](./docs/environment-setup.md)** - Detailed setup instructions
- **[API Documentation](./docs/api/README.md)** - API endpoints and schemas
- **[Background Jobs](./docs/background-jobs.md)** - Job orchestration guide
- **[Browser Extension](./docs/browser-extension.md)** - Extension development

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Run unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Run tests with coverage
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run E2E tests with UI

# Background Jobs
npm run jobs:etsy-ingest          # Sync Etsy listings
npm run jobs:keyword-serp-sampler # Sample SERP positions
npm run jobs:ingest-metrics       # Daily demand index and trend scoring

# Scraping
npm run scrape:etsy               # Scrape Etsy marketplace
npm run scrape:etsy-keywords      # Extract keywords from listings
npm run scrape:etsy-best-sellers  # Track best-sellers

# Browser Extension
npm run extension:build  # Build Chrome extension
```

### Project Structure

```
lexyhub/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (app)/          # Protected app routes
│   │   ├── api/            # API routes
│   │   └── auth/           # Authentication routes
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components
│   │   ├── keywords/      # Keyword features
│   │   ├── insights/      # Analytics components
│   │   └── editing/       # Listing editor
│   ├── lib/               # Business logic
│   │   ├── ai/           # AI/ML utilities
│   │   ├── etsy/         # Etsy integration
│   │   ├── keywords/     # Keyword processing
│   │   └── auth/         # Authentication
│   └── types/            # TypeScript types
├── supabase/             # Database migrations
├── tests/                # Test suites
│   ├── e2e/             # End-to-end tests
│   └── fixtures/        # Test fixtures
├── jobs/                 # Background job scripts
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── apps/                 # Separate applications
    └── browser-extension/ # Chrome extension
```

### Database Migrations

Migrations are managed with Supabase CLI:

```bash
# Create a new migration
supabase migration new your_migration_name

# Run migrations
supabase db push

# Reset database (local only)
supabase db reset
```

### Testing

```bash
# Run all unit tests
npm run test

# Run with coverage (40% threshold)
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

### Code Quality

We use ESLint, Prettier, and Husky for code quality:

```bash
# Lint code
npm run lint

# Type check
npm run typecheck

# Pre-commit hooks run automatically
# - Prettier check
# - ESLint
# - Type checking
```

## 🏭 Deployment

### Vercel Deployment (Recommended)

1. **Connect your repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Deploy**:
   ```bash
   vercel deploy --prod
   ```

### Environment Variables

Required for production:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI (required for AI features)
OPENAI_API_KEY=

# Etsy Integration (optional)
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=

# Stripe (optional, for billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Admin (optional)
LEXYHUB_ADMIN_EMAILS=admin@example.com

# Security
LEXYHUB_JWT_SECRET=your-secure-secret
```

## 🔐 Security

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row-level security (RLS) in PostgreSQL
- **API Security**: Rate limiting, input validation
- **Data Encryption**: At-rest and in-transit encryption
- **Secrets Management**: Environment variables only

Report security vulnerabilities to: security@lexyhub.com

## 📊 Seasonal Demand Index & Trend Momentum

### Overview

LexyHub computes seasonal-aware demand indices and trend momentum for all keywords, enabling data-driven decisions aligned with retail calendar peaks.

### Key Concepts

- **Base Demand Index (0-100)**: Normalized score combining search volume, traffic rank, and competition
- **Adjusted Demand Index**: Base DI weighted by active seasonal periods (e.g., Black Friday 1.5x, Christmas 1.8x)
- **Trend Momentum (%)**: Week-over-week or month-over-month percentage change
- **Deseasoned Trend Momentum**: Trend relative to same-period baseline (last year)
- **Opportunity Badges**: Hot, Rising, Stable, Cooling based on combined metrics

### Running the Daily ETL Job

Metrics are collected and scored daily via GitHub Actions at 05:55 UTC. To run manually:

```bash
npm run jobs:ingest-metrics
```

### Environment Variables

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
COUNTRY=global
LOOKBACK_DAYS=7
```

### Seasonal Periods

Global and country-specific retail periods are seeded in `seasonal_periods`:
- Black Friday, Cyber Monday, Christmas, New Year
- Valentine's Day, Easter, Mother's Day, Father's Day
- Halloween, Singles' Day (China), Golden Week (Japan/China)
- Back to School, Summer Sales, Q4 Global Uplift
- Independence Day (US), and more

### Database Functions

- `compute_base_demand_index(_kw, _as_of, _source)`: Compute base DI
- `compute_adjusted_demand_index(_kw, _as_of, _source, _country)`: Apply seasonal weight
- `compute_trend_momentum(_kw, _as_of, _source, _lookback)`: Calculate WoW/MoM trend
- `compute_deseasoned_tm(_kw, _as_of, _source, _lookback)`: Relative to baseline
- `apply_demand_trend_for_date(_as_of, _source, _country, _lookback)`: Bulk update all keywords

### API Endpoints

**GET /api/keywords/scored**

Query parameters:
- `q`: Search term filter
- `market`: Market filter (us, uk, de)
- `country`: Seasonal country (global, US, UK, CN, JP)
- `minDI`: Minimum adjusted demand index
- `minTM`: Minimum trend momentum
- `sort`: Sort field (adjusted_demand_index.desc, trend_momentum.desc)
- `limit`: Results per page
- `offset`: Pagination offset

### UI

Navigate to `/keywords/scored` to view the scored keywords dashboard with:
- Real-time demand indices and trend momentum
- Color-coded opportunity badges
- 14-day sparklines for adjusted DI
- Global/country seasonal filters

### Testing

Run the test suite:

```bash
npm run test tests/compute_di_tm.test.ts
```

### Observability

All runs are logged in `demand_trend_runs` with:
- Run timestamp
- Status (success/error)
- Statistics (keywords processed, metrics collected, updates applied)
- Error messages (if any)

## 📊 Monitoring & Observability

- **Analytics**: Vercel Analytics
- **Error Tracking**: (Setup in progress - see Sprint 1)
- **Logs**: Structured logging with context
- **Performance**: Web Vitals tracking
- **Job Monitoring**: `demand_trend_runs` table tracks daily ETL execution

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Code of conduct
- Development workflow
- Pull request process
- Coding standards
- Testing requirements

## 📝 License

Proprietary - All rights reserved.

This software is confidential and proprietary. Unauthorized copying, distribution, or use is strictly prohibited.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/dxhub-apps/lexyhub/issues)
- **Email**: support@lexyhub.com
- **Slack**: [Join our workspace](#)

## 🗺️ Roadmap

See [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md) for our 3-sprint improvement roadmap:

- **Sprint 1**: Foundation & Stability (Testing, Documentation, Security)
- **Sprint 2**: Performance & Modernization (Dependencies, Optimization)
- **Sprint 3**: Advanced Features & Polish (E2E Testing, CI/CD, Monitoring)

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [OpenAI](https://openai.com/) - AI/ML APIs
- [Vercel](https://vercel.com/) - Deployment platform
- [Playwright](https://playwright.dev/) - Web scraping & testing

---

**Made with ❤️ for e-commerce sellers worldwide**
