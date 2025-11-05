# Editing Suite Module

> AI-powered Etsy listing optimization tools

## Overview

The Editing Suite is a self-contained module within the Lexy app that provides three core optimization tools for Etsy sellers:

1. **Listing Intelligence** - Quality audits and recommendations
2. **Competitor Analysis** - Market benchmarking and insights
3. **Tag Optimizer** - Data-driven tag improvements

## Directory Structure

```
editing/
├── README.md                        # This file
├── layout.tsx                       # Shared layout with hero and navigation
├── page.tsx                         # Overview dashboard
├── listing-intelligence/
│   └── page.tsx                     # Quality audit tool
├── competitor-analysis/
│   └── page.tsx                     # Market benchmarking tool
└── tag-optimizer/
    └── page.tsx                     # Tag optimization tool
```

## Architecture

### Layout Pattern

The suite uses Next.js App Router layout system:

```tsx
EditingLayout (layout.tsx)
  ├── Hero Header
  ├── EditingNav (navigation tabs)
  └── {children} (page content)
```

**Key Features:**
- Server Component layout for optimal performance
- Client Component navigation for active state tracking
- Scoped `.editing-*` CSS classes for styling isolation

### Page Structure

Each tool page follows a consistent pattern:

```tsx
export const metadata = { title, description };

export default function ToolPage() {
  return (
    <div className="editing-tool">
      <ToolForm />
    </div>
  );
}
```

**Benefits:**
- SEO-optimized with Next.js Metadata API
- Clean separation between pages and form logic
- Consistent wrapper classes for styling

## Components

### EditingNav

**Location:** `src/components/editing/EditingNav.tsx`

**Purpose:** Client-side navigation with active state tracking

**Features:**
- Uses `usePathname()` for route awareness
- Highlights active tab with `.editing-nav-item--active`
- Accessible with ARIA labels and `aria-current`
- Two-line layout (label + description)

**Usage:**
```tsx
import { EditingNav } from "@/components/editing/EditingNav";

<EditingNav />
```

### Form Components

Each tool has a dedicated form component:

| Component | Location | Purpose |
|-----------|----------|---------|
| `ListingIntelligenceForm` | `src/components/editing/ListingIntelligenceForm.tsx` | Quality audit inputs and results |
| `CompetitorAnalysisForm` | `src/components/editing/CompetitorAnalysisForm.tsx` | Competitor data collection and insights |
| `TagOptimizerForm` | `src/components/editing/TagOptimizerForm.tsx` | Tag evaluation and recommendations |

## API Integration

### Endpoints

All tools connect to dedicated API routes:

```typescript
// Listing Intelligence
POST /api/listings/intelligence
{ listingId?, title, description, tags, ... }

// Competitor Analysis
POST /api/insights/competitors
{ keyword, competitors: [...] }

// Tag Optimizer
POST /api/tags/health
{ listingId?, tags: [...] }

GET /api/tags/health?listingId=xxx
```

See `docs/editing-app.md` for complete API documentation.

## Styling

### CSS Classes

The suite uses scoped classes for styling:

```css
/* Layout */
.editing-layout          /* Main wrapper */
.editing-hero            /* Hero header */
.editing-content         /* Page content area */

/* Navigation */
.editing-nav             /* Navigation container */
.editing-nav-item        /* Nav link */
.editing-nav-item--active /* Active state */
.editing-nav-item-label  /* Label text */
.editing-nav-item-description /* Description text */

/* Tools */
.editing-tool            /* Tool page wrapper */
.analysis-*              /* Result panels (various) */
```

**Location:** `src/app/globals.css`

### Design System

The suite inherits from the main app design system:

- **Cards:** Uses `@/components/ui/card` for content blocks
- **Buttons:** Uses `@/components/ui/button` for actions
- **Icons:** Uses `lucide-react` for consistent iconography
- **Typography:** Inherits Tailwind typography settings

## Development

### Adding a New Tool

1. **Create page directory:**
   ```bash
   mkdir src/app/(app)/editing/your-tool
   ```

2. **Add page component:**
   ```tsx
   // src/app/(app)/editing/your-tool/page.tsx
   import { Metadata } from "next";
   import { YourToolForm } from "@/components/editing/YourToolForm";

   export const metadata: Metadata = {
     title: "Your Tool | Editing Suite",
     description: "Tool description",
   };

   export default function YourToolPage() {
     return (
       <div className="editing-tool">
         <YourToolForm />
       </div>
     );
   }
   ```

3. **Update navigation:**
   ```tsx
   // src/components/editing/EditingNav.tsx
   const NAV_ITEMS = [
     // ... existing items
     {
       href: "/editing/your-tool",
       label: "Your Tool",
       description: "Short desc"
     },
   ];
   ```

4. **Create form component:**
   ```bash
   touch src/components/editing/YourToolForm.tsx
   ```

5. **Add API route** (if needed):
   ```bash
   mkdir -p src/app/api/your-endpoint
   touch src/app/api/your-endpoint/route.ts
   ```

### Testing

```bash
# Build check
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Local development
npm run dev
# Navigate to http://localhost:3000/editing
```

### Accessibility Checklist

- [ ] All navigation links have proper `aria-current`
- [ ] Forms have associated labels and fieldsets
- [ ] Interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Error messages are screen reader friendly

## Database Schema

The suite requires these tables (via `0011_editing_suite.sql`):

- `listing_quality_audits` - Intelligence results
- `competitor_snapshots` - Analysis results
- `competitor_snapshot_listings` - Competitor data
- `tag_catalog` - Tag reference database
- `listing_tag_health` - Tag diagnostics
- `tag_optimizer_runs` - Optimization history

See `docs/editing-app.md` for complete schema documentation.

## Analytics

The suite tracks usage via Vercel Analytics:

```typescript
// Events emitted
listing.intelligence.run   // Quality audits
competitor.analysis.run    // Market analysis
tag.optimizer.run          // Tag optimization
```

**Metrics to monitor:**
- Usage frequency per tool
- Average quality scores
- Recommendation acceptance rates
- Time spent per session

## Performance

### Optimization Strategies

1. **Server Components** - Layout and pages are server-rendered
2. **Client Boundaries** - Only navigation is client-side
3. **Code Splitting** - Form components lazy load when needed
4. **Database Indexing** - Queries use indexed columns
5. **Caching** - Consider Redis for tag catalog

### Bundle Size

Current approximate sizes:
- Layout: ~5KB (gzipped)
- Navigation: ~2KB (gzipped)
- Forms: ~15-25KB each (gzipped)

## Troubleshooting

### Common Issues

**Navigation not showing active state:**
- Verify `usePathname()` returns correct path
- Check `.editing-nav-item--active` CSS class exists
- Clear browser cache and hard reload

**Forms not submitting:**
- Check API endpoint is accessible
- Verify authentication headers
- Review browser console for errors

**Styling looks broken:**
- Ensure `globals.css` includes `.editing-*` classes
- Verify Tailwind is processing correctly
- Check for CSS specificity conflicts

**Metadata not appearing:**
- Confirm page exports `metadata` object
- Verify Next.js version supports Metadata API
- Check build output for static metadata

## Documentation

- **Full Documentation:** `docs/editing-app.md`
- **API Reference:** `docs/editing-app.md#api-reference`
- **Data Model:** `docs/editing-app.md#data-model`
- **Best Practices:** `docs/editing-app.md#best-practices`
- **Troubleshooting:** `docs/editing-app.md#troubleshooting`

## Contributing

When modifying the editing suite:

1. Update component documentation (JSDoc comments)
2. Add tests for new functionality
3. Update this README if structure changes
4. Maintain consistent code style
5. Document any new API endpoints
6. Update migration files if schema changes

## Support

For questions or issues:
- Check `docs/editing-app.md` for detailed documentation
- Review code comments in component files
- Search existing GitHub issues
- Contact the development team

---

**Last Updated:** 2025-11-05
**Version:** 1.0.0
**Maintainers:** Lexy Development Team
