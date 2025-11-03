# LexyHub Design System

**Version 2.0** — Modern, minimal, and production-ready

---

## Philosophy

LexyHub's design system is built on principles of **clarity, restraint, and performance**. Inspired by Linear, Vercel, and Arc Browser, we prioritize:

- **Black and white core palette** — Pure contrast, no visual noise
- **Functional color** — Accent colors only where necessary (status, charts, dashboard)
- **Typography over decoration** — Content-first, clean hierarchy
- **Intentional motion** — Subtle transitions, purposeful animations
- **Accessibility first** — WCAG 2.1 AA compliant

---

## Colors

### Core Palette

The design system uses a **pure black and white** foundation:

#### Light Theme
```css
--background: 0 0% 100%;     /* Pure white */
--foreground: 0 0% 0%;       /* Pure black */
--primary: 0 0% 0%;          /* Black actions */
--primary-foreground: 0 0% 100%;
--secondary: 0 0% 96%;       /* Very light gray */
--muted: 0 0% 96%;
--border: 0 0% 90%;
```

#### Dark Theme
```css
--background: 0 0% 0%;       /* Pure black */
--foreground: 0 0% 100%;     /* Pure white */
--primary: 0 0% 100%;        /* White actions */
--primary-foreground: 0 0% 0%;
--secondary: 0 0% 10%;       /* Very dark gray */
--muted: 0 0% 10%;
--border: 0 0% 15%;
```

### Functional Colors

Used **only** for status indicators, toasts, and dashboard data visualization:

```css
/* Success - Green */
--success: 142 76% 36%;
--success-foreground: 0 0% 100%;

/* Warning - Amber */
--warning: 38 92% 50%;
--warning-foreground: 0 0% 0%;

/* Destructive - Red */
--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 100%;
```

### Chart Colors

Monochrome scale for data visualization (dashboard only):

```css
--chart-1: 0 0% 0%;    /* Black */
--chart-2: 0 0% 30%;   /* Dark gray */
--chart-3: 0 0% 50%;   /* Medium gray */
--chart-4: 0 0% 70%;   /* Light gray */
--chart-5: 0 0% 85%;   /* Very light gray */
```

---

## Typography

### Font Stack

System fonts for zero-latency rendering:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Type Scale

```css
xs:   0.75rem / 1rem      (12px / 16px line)
sm:   0.875rem / 1.25rem  (14px / 20px line)
base: 0.9375rem / 1.5rem  (15px / 24px line)  ← Body text
lg:   1.125rem / 1.75rem  (18px / 28px line)
xl:   1.25rem / 1.75rem   (20px / 28px line)
2xl:  1.5rem / 2rem       (24px / 32px line)
3xl:  1.875rem / 2.25rem  (30px / 36px line)
4xl:  2.25rem / 2.5rem    (36px / 40px line)
```

### Headings

All headings use `font-semibold` and `tracking-tight`:

```css
h1: text-3xl sm:text-4xl
h2: text-2xl sm:text-3xl
h3: text-xl sm:text-2xl
h4: text-lg sm:text-xl
h5: text-base sm:text-lg
h6: text-sm sm:text-base
```

---

## Spacing

Based on a **4px grid** with semantic naming:

```css
1:  0.25rem  (4px)
2:  0.5rem   (8px)
3:  0.75rem  (12px)
4:  1rem     (16px)
5:  1.25rem  (20px)
6:  1.5rem   (24px)
8:  2rem     (32px)
10: 2.5rem   (40px)
12: 3rem     (48px)
16: 4rem     (64px)
```

### Layout Spacing

```css
Page padding:   px-4 py-6 sm:px-6 lg:px-8
Card padding:   p-6
Section gap:    space-y-6
Grid gap:       gap-4
```

---

## Border Radius

Restrained rounding for clean, modern feel:

```css
--radius: 0.5rem (8px)

sm: calc(var(--radius) - 4px)  → 4px
md: calc(var(--radius) - 2px)  → 6px
lg: var(--radius)               → 8px
```

Usage:
- Buttons: `rounded-md`
- Cards: `rounded-lg`
- Inputs: `rounded-md`
- Pills/badges: `rounded-full`

---

## Shadows

Minimal elevation, subtle depth:

```css
sm:  0 1px 2px 0 rgb(0 0 0 / 0.05)
md:  0 4px 6px -1px rgb(0 0 0 / 0.1)
lg:  0 10px 15px -3px rgb(0 0 0 / 0.1)
```

Usage:
- Cards: `shadow-sm`
- Popovers: `shadow-md`
- Modals: `shadow-lg`

---

## Components

### Button

```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button loading>Processing...</Button>
```

**Variants:**
- `default` — Black (light) or white (dark) with full fill
- `secondary` — Light gray background
- `outline` — Border only, transparent fill
- `ghost` — Transparent, hover accent
- `destructive` — Red, for delete/remove actions

**Sizes:** `sm`, `default`, `lg`, `icon`

---

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Supporting text</CardDescription>
  </CardHeader>
  <CardContent>
    Main content
  </CardContent>
  <CardFooter>
    Actions
  </CardFooter>
</Card>
```

---

### Input

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

---

### Badge

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

---

### Progress

```tsx
import { Progress } from "@/components/ui/progress";

<Progress value={60} className="h-2" />
```

---

### Skeleton

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-8 w-full" />
</div>
```

---

### Toast

```tsx
import { useToast } from "@/components/ui/use-toast";

const { toast } = useToast();

toast({
  title: "Success",
  description: "Your changes have been saved.",
  variant: "default",
});

toast({
  title: "Error",
  description: "Something went wrong.",
  variant: "destructive",
});
```

**Variants:** `default`, `destructive`, `success`, `warning`

---

### Dialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description text
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      Dialog content
    </div>
  </DialogContent>
</Dialog>
```

---

### Dropdown Menu

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost">Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    Overview content
  </TabsContent>
  <TabsContent value="analytics">
    Analytics content
  </TabsContent>
</Tabs>
```

---

### Select

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

## Utilities

### Class Name Merging

```tsx
import { cn } from "@/lib/utils";

const className = cn(
  "base-class",
  condition && "conditional-class",
  "override-class"
);
```

### Number Formatting

```tsx
import { formatCompact, formatPercent, formatNumber } from "@/lib/utils";

formatCompact(1500);      // "1.5K"
formatCompact(2000000);   // "2.0M"
formatPercent(45.6, 1);   // "45.6%"
formatNumber(10000);      // "10,000"
```

### Relative Time

```tsx
import { formatRelativeTime } from "@/lib/utils";

formatRelativeTime(new Date(Date.now() - 60000));     // "1m ago"
formatRelativeTime(new Date(Date.now() - 3600000));   // "1h ago"
formatRelativeTime(new Date(Date.now() - 86400000));  // "1d ago"
```

---

## Layout

### Page Container

```tsx
<div className="app-container">
  {/* Max width 1600px, responsive padding */}
</div>
```

### Grid Layouts

```tsx
{/* Two-column responsive grid */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <Card>...</Card>
  <Card>...</Card>
</div>

{/* Three-column responsive grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

---

## Animations

All animations use consistent durations and easings:

```css
transition-colors     /* 150ms ease */
transition-all        /* 150ms ease */
duration-200          /* 200ms */
```

### Hover States

- Buttons: `hover:bg-primary/90`
- Links: `hover:underline`
- Cards: `hover:shadow-md transition-shadow`

---

## Accessibility

### Focus Rings

All interactive elements have visible focus states:

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

### Screen Reader Text

```tsx
<span className="sr-only">Screen reader text</span>
```

### ARIA Labels

Always include for icon-only buttons:

```tsx
<Button variant="ghost" size="icon" aria-label="Close menu">
  <X className="h-4 w-4" />
</Button>
```

---

## Responsive Breakpoints

```css
sm:  640px   /* Tablet portrait */
md:  768px   /* Tablet landscape */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large */
```

---

## Dark Mode

Toggle theme using `useTheme` hook:

```tsx
import { useTheme } from "@/components/theme/ThemeProvider";

const { theme, setTheme } = useTheme();

<Button onClick={() => setTheme("dark")}>Dark Mode</Button>
<Button onClick={() => setTheme("light")}>Light Mode</Button>
<Button onClick={() => setTheme("system")}>System</Button>
```

---

## Best Practices

### DO:
✅ Use semantic HTML (`<button>`, `<nav>`, `<main>`)
✅ Provide ARIA labels for icon-only actions
✅ Use `<Label>` components for form inputs
✅ Test keyboard navigation
✅ Use `loading` prop on async buttons
✅ Show empty states with helpful CTAs
✅ Use Skeleton for loading states

### DON'T:
❌ Use color alone to convey meaning
❌ Nest buttons inside buttons
❌ Use `<div onClick>` instead of `<button>`
❌ Forget focus states
❌ Use fixed widths on text elements
❌ Add unnecessary animations

---

## Component Development

When creating new components:

1. **Start with shadcn/ui** — Use existing primitives
2. **Compose, don't create** — Combine components rather than build from scratch
3. **Name consistently** — Follow `ComponentName` PascalCase convention
4. **Export properly** — Named exports for all components
5. **Type everything** — Full TypeScript coverage
6. **Document props** — JSDoc comments for component APIs

---

## File Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── layout/          # App shell, navigation
│   ├── [feature]/       # Feature-specific components
├── lib/
│   ├── utils.ts         # Utility functions
│   └── ...
├── app/
│   ├── globals.css      # Design tokens, utilities
│   └── ...
```

---

## Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last updated:** November 2025
**Maintainer:** LexyHub Design Team
