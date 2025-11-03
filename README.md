# LexyHub

> The central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating market intelligence across multiple e-commerce marketplaces.

[![CI](https://github.com/dxhub-apps/lexyhub/actions/workflows/ci.yml/badge.svg)](https://github.com/dxhub-apps/lexyhub/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue)](./LICENSE)

**LexyHub** is an AI-powered cross-marketplace commerce intelligence platform designed for e-commerce businesses selling on Etsy, Amazon, and other online marketplaces. It provides keyword discovery, trend analysis, market simulation, and listing optimization tools to help sellers understand market dynamics and maximize their revenue.

## ✨ Features

### 🎯 **Keyword Intelligence**
- AI-powered semantic keyword search across multiple data sources
- 3,072-dimensional vector embeddings for similarity matching (pgvector)
- Real-time demand, competition, and momentum scoring
- Automatic intent classification and opportunity analysis
- Tag optimization with GPT-powered suggestions

### 📊 **Insights & Analytics**
- **Trend Radar**: Multi-source trend aggregation (Google Trends, Pinterest, Reddit)
- **Intent Graph**: Purchase intent classification and funnel analysis
- **Competitor Analysis**: Pricing, tone, and market saturation benchmarking
- **Visual Tag AI**: Image-to-tag generation with BLIP-2 + GPT

### 🔍 **Watchlists & Monitoring**
- Track keywords and listings across marketplaces
- SERP position tracking with historical snapshots
- Automated alerts for inventory risks and policy changes
- Real-time sync with Etsy, Amazon, and more

### 💡 **Market Twin Simulator**
- Scenario planning engine for "what-if" analysis
- Simulate pricing changes, ad spend, and conversion impacts
- Revenue and margin forecasting
- Team collaboration with saved scenarios

### ✏️ **Listing Optimization**
- AI-powered listing quality audits
- Tag health scoring against catalog
- Quick-fix recommendations
- Listing intelligence with competitor benchmarking

### 📈 **Dashboard & Reporting**
- Sales velocity monitoring vs. targets
- Momentum charts for trailing performance
- Quota pulse cards and KPI tracking
- Revenue pacing analysis

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

## 📊 Monitoring & Observability

- **Analytics**: Vercel Analytics
- **Error Tracking**: (Setup in progress - see Sprint 1)
- **Logs**: Structured logging with context
- **Performance**: Web Vitals tracking

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
