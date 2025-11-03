/**
 * Input Validation Middleware
 *
 * Provides request validation using Zod schemas for type-safe API routes.
 *
 * Usage:
 *   import { validateRequest, validateQuery, validateBody } from '@/lib/middleware/validation';
 *   import { z } from 'zod';
 *
 *   const schema = z.object({ name: z.string(), age: z.number() });
 *
 *   export async function POST(request: Request) {
 *     const body = await validateBody(request, schema);
 *     // body is now type-safe!
 *   }
 */

import { NextRequest } from "next/server";
import { z, ZodSchema } from "zod";
import { ValidationError } from "@/lib/api/errors";

/**
 * Validate request body against schema
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid request body", error.errors);
    }
    throw new ValidationError("Failed to parse request body");
  }
}

/**
 * Validate query parameters against schema
 */
export function validateQuery<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    // Convert string numbers to actual numbers for common params
    const converted = Object.entries(query).reduce(
      (acc, [key, value]) => {
        // Try to convert numeric strings
        if (!isNaN(Number(value)) && value !== "") {
          acc[key] = Number(value);
        } else if (value === "true" || value === "false") {
          acc[key] = value === "true";
        } else {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>
    );

    return schema.parse(converted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid query parameters", error.errors);
    }
    throw new ValidationError("Failed to parse query parameters");
  }
}

/**
 * Validate path parameters against schema
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string | string[]>,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid path parameters", error.errors);
    }
    throw new ValidationError("Failed to parse path parameters");
  }
}

/**
 * Validate headers against schema
 */
export function validateHeaders<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    return schema.parse(headers);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid headers", error.errors);
    }
    throw new ValidationError("Failed to parse headers");
  }
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  }),

  // Sorting
  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),

  // Search
  search: z.object({
    q: z.string().min(1).max(100),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // UUID
  uuid: z.string().uuid(),

  // Email
  email: z.string().email(),

  // URL
  url: z.string().url(),
};

/**
 * Validated request wrapper
 */
export interface ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
> {
  body: TBody;
  query: TQuery;
  params: TParams;
  request: NextRequest;
}

/**
 * Create a validated request handler
 *
 * @example
 * const handler = createValidatedHandler({
 *   body: z.object({ name: z.string() }),
 *   query: commonSchemas.pagination,
 * }, async ({ body, query }) => {
 *   // All inputs are validated and type-safe!
 *   return NextResponse.json({ name: body.name, page: query.page });
 * });
 *
 * export const POST = handler;
 */
export function createValidatedHandler<
  TBodySchema extends ZodSchema | null = null,
  TQuerySchema extends ZodSchema | null = null,
  TParamsSchema extends ZodSchema | null = null
>(
  schemas: {
    body?: TBodySchema;
    query?: TQuerySchema;
    params?: TParamsSchema;
  },
  handler: (
    validated: ValidatedRequest<
      TBodySchema extends ZodSchema ? z.infer<TBodySchema> : never,
      TQuerySchema extends ZodSchema ? z.infer<TQuerySchema> : never,
      TParamsSchema extends ZodSchema ? z.infer<TParamsSchema> : never
    >
  ) => Promise<Response>
) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string | string[]> }
  ) => {
    // Validate body
    const body = schemas.body
      ? await validateBody(request, schemas.body)
      : undefined;

    // Validate query
    const query = schemas.query
      ? validateQuery(request, schemas.query)
      : undefined;

    // Validate params
    const params =
      schemas.params && context?.params
        ? validateParams(context.params, schemas.params)
        : undefined;

    return handler({
      body: body as any,
      query: query as any,
      params: params as any,
      request,
    });
  };
}
