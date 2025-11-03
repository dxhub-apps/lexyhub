# Contributing to LexyHub

Thank you for your interest in contributing to LexyHub! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Issue Guidelines](#issue-guidelines)

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone. We expect all contributors to:

- Be respectful and professional
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discriminatory language, or personal attacks
- Publishing others' private information
- Trolling or insulting comments
- Other conduct that would be inappropriate in a professional setting

## 🚀 Getting Started

### Prerequisites

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/lexyhub.git
   cd lexyhub
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/dxhub-apps/lexyhub.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

6. **Run the development server**:
   ```bash
   npm run dev
   ```

### Development Environment

- **Node.js**: 20+ required
- **npm**: 10+ required
- **Editor**: VS Code recommended with the following extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense

## 🔄 Development Workflow

### Branch Naming Convention

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
git checkout -b fix/bug-description
git checkout -b docs/documentation-update
git checkout -b refactor/code-improvement
git checkout -b test/test-addition
```

### Branch Types

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring (no functional changes)
- `test/` - Test additions or modifications
- `chore/` - Build process, dependency updates
- `perf/` - Performance improvements

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## 💻 Coding Standards

### TypeScript

- **Always use TypeScript** - No plain JavaScript files
- **Strict mode enabled** - No `any` types unless absolutely necessary
- **Use interfaces** for object shapes
- **Use type** for unions, primitives, and tuples
- **Export types** alongside implementation

### Code Style

We use **ESLint** and **Prettier** for consistent code formatting:

```bash
# Check linting
npm run lint

# Check types
npm run typecheck

# Format code (done automatically by pre-commit hooks)
npx prettier --write .
```

### File Organization

```typescript
// 1. Imports (external first, then internal)
import { useState } from "react";
import { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/Button";
import { getUserProfile } from "@/lib/auth/profile";

// 2. Types and interfaces
interface Props {
  userId: string;
  onSuccess?: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

// 3. Constants
const DEFAULT_RETRY_COUNT = 3;

// 4. Component/function implementation
export function MyComponent({ userId, onSuccess }: Props) {
  // Implementation
}

// 5. Helper functions (non-exported)
function helperFunction() {
  // Implementation
}
```

### Naming Conventions

- **Files**: kebab-case (`user-profile.ts`)
- **Components**: PascalCase (`UserProfile.tsx`)
- **Functions**: camelCase (`getUserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Interfaces**: PascalCase with descriptive names (`UserProfile`, not `IUserProfile`)
- **Types**: PascalCase (`ApiResponse<T>`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (`isLoading`, `hasError`)

### React Component Guidelines

#### Prefer Function Components

```typescript
// ✅ Good
export function UserProfile({ userId }: Props) {
  return <div>...</div>;
}

// ❌ Avoid
export const UserProfile: React.FC<Props> = ({ userId }) => {
  return <div>...</div>;
};
```

#### Use Hooks Properly

```typescript
// ✅ Good - hooks at top level
function Component() {
  const [state, setState] = useState(0);
  const data = useData();

  if (loading) return <Loading />;

  return <div>...</div>;
}

// ❌ Bad - conditional hooks
function Component() {
  if (condition) {
    const [state, setState] = useState(0); // ❌ Never
  }
}
```

#### Server vs Client Components

```typescript
// Server Component (default in App Router)
// - No useState, useEffect, or event handlers
// - Can fetch data directly
// - Better performance

export async function ServerComponent() {
  const data = await fetchData(); // ✅ Can await directly
  return <div>{data}</div>;
}

// Client Component (when needed)
// - Use 'use client' directive
// - For interactivity, state, effects

'use client';

export function ClientComponent() {
  const [count, setCount] = useState(0); // ✅ Client-only features
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### API Route Guidelines

```typescript
// src/app/api/example/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 1. Define request schema
const requestSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["create", "update", "delete"]),
});

// 2. Export HTTP method handlers
export async function POST(request: NextRequest) {
  try {
    // 3. Validate input
    const body = await request.json();
    const validated = requestSchema.parse(body);

    // 4. Business logic
    const result = await performAction(validated);

    // 5. Return response
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // 6. Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Error Handling

```typescript
// ✅ Good - specific error types
try {
  const result = await riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NetworkError) {
    // Handle network error
  } else {
    // Handle unknown error
    logger.error("Unexpected error", { error });
  }
}

// ❌ Bad - catching everything as any
try {
  await riskyOperation();
} catch (error: any) {
  console.log(error.message); // ❌ Unsafe
}
```

### Database Queries

```typescript
// ✅ Good - use type-safe Supabase client
const { data, error } = await supabase
  .from("users")
  .select("id, name, email")
  .eq("id", userId)
  .single();

if (error) {
  throw new Error(`Failed to fetch user: ${error.message}`);
}

// ✅ Good - use transactions for multiple operations
const { error } = await supabase.rpc("create_user_with_profile", {
  user_email: email,
  profile_data: profileData,
});
```

## 📝 Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependency updates
- `perf`: Performance improvements

### Examples

```bash
# Feature
git commit -m "feat(keywords): add semantic similarity search"

# Bug fix
git commit -m "fix(auth): resolve session timeout issue"

# Documentation
git commit -m "docs(api): add OpenAPI specification"

# With body
git commit -m "feat(dashboard): add revenue tracking

- Add revenue chart component
- Implement data aggregation
- Add export functionality

Closes #123"
```

### Commit Message Rules

- Use imperative mood ("add" not "added" or "adds")
- First line should be 50 characters or less
- Separate subject from body with a blank line
- Wrap body at 72 characters
- Reference issues and pull requests in the footer

## 🔀 Pull Request Process

### Before Submitting

1. **Update your branch** with latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

3. **Write/update tests** for your changes
4. **Update documentation** if needed
5. **Add changeset** (if applicable)

### PR Title

Follow the same convention as commit messages:

```
feat(keywords): add semantic similarity search
fix(auth): resolve session timeout issue
docs(api): add OpenAPI specification
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All CI checks passing

## Related Issues
Closes #123
Relates to #456

## Screenshots (if applicable)
[Add screenshots here]

## Additional Notes
[Any additional context]
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one approval** required from maintainers
3. **All comments addressed** before merging
4. **Squash and merge** is preferred for clean history

### After Approval

Maintainers will merge using "Squash and merge" to keep history clean.

## ✅ Testing Requirements

### Unit Tests

- **Required** for all new functions and utilities
- **Coverage threshold**: 40% minimum (see `vitest.config.ts`)
- **Location**: `src/lib/__tests__/`

```typescript
// src/lib/__tests__/my-feature.test.ts
import { describe, expect, it } from "vitest";
import { myFunction } from "../my-feature";

describe("myFunction", () => {
  it("should handle normal input", () => {
    expect(myFunction("input")).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(myFunction("")).toBe("");
    expect(myFunction(null)).toBeNull();
  });

  it("should throw on invalid input", () => {
    expect(() => myFunction(undefined)).toThrow();
  });
});
```

### Integration Tests

- **Required** for API routes
- Test with mocked database

### E2E Tests

- **Recommended** for critical user flows
- Use Playwright Test
- Location: `tests/e2e/`

```typescript
// tests/e2e/feature.spec.ts
import { test, expect } from "@playwright/test";

test("user can complete critical flow", async ({ page }) => {
  await page.goto("/");
  // Test implementation
});
```

### Running Tests

```bash
# Unit tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## 📖 Documentation

### Code Documentation

- **JSDoc comments** for public functions
- **Inline comments** for complex logic
- **Type annotations** for clarity

```typescript
/**
 * Normalizes a keyword term for consistent hashing.
 *
 * @param term - The raw keyword term
 * @returns Normalized lowercase term with collapsed whitespace
 * @example
 * normalizeKeywordTerm("  HELLO World  ") // "hello world"
 */
export function normalizeKeywordTerm(term: string): string {
  return term.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
```

### Documentation Files

- Update relevant docs in `/docs` directory
- Keep README.md in sync with changes
- Add examples for new features

## 🐛 Issue Guidelines

### Bug Reports

Include:
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, browser, Node version
- **Screenshots**: If applicable

### Feature Requests

Include:
- **Description**: Clear description of the feature
- **Use Case**: Why is this needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other approaches considered

### Issue Labels

- `bug`: Something isn't working
- `feature`: New feature request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `priority:high`: Critical issue

## 🎯 Getting Help

- **Documentation**: Check `/docs` directory
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions
- **Slack**: Join our workspace (link in README)

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (when available)

Thank you for contributing to LexyHub! 🚀
