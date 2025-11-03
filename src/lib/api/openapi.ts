/**
 * OpenAPI/Swagger Documentation Generator
 *
 * Provides utilities to generate OpenAPI 3.0 specifications for API routes.
 *
 * Usage:
 *   1. Add JSDoc comments with @openapi tags to your API routes
 *   2. Use the openapi helper to generate spec
 *   3. View docs at /api/docs
 */

/**
 * OpenAPI 3.0 specification structure
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
    responses?: Record<string, Response>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
}

interface Parameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema: Schema;
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: Schema }>;
}

interface Response {
  description: string;
  content?: Record<string, { schema: Schema }>;
  headers?: Record<string, { schema: Schema }>;
}

interface Schema {
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
  example?: any;
  description?: string;
  $ref?: string;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

/**
 * Base OpenAPI specification for LexyHub
 */
export const baseSpec: OpenAPISpec = {
  openapi: "3.0.0",
  info: {
    title: "LexyHub API",
    version: "1.0.0",
    description:
      "AI-powered cross-marketplace commerce intelligence platform API. Provides keyword discovery, trend analysis, and listing optimization.",
    contact: {
      name: "LexyHub Support",
      email: "support@lexyhub.com",
      url: "https://lexyhub.com",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "https://lexyhub.vercel.app",
      description: "Production server",
    },
  ],
  paths: {},
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error name",
          },
          message: {
            type: "string",
            description: "Error message",
          },
          code: {
            type: "integer",
            description: "HTTP status code",
          },
          details: {
            description: "Additional error details",
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
        },
        required: ["error", "message", "code", "timestamp"],
      },
      Keyword: {
        type: "object",
        properties: {
          id: { type: "integer" },
          term: { type: "string" },
          demandScore: { type: "number", format: "float" },
          competitionScore: { type: "number", format: "float" },
          trendMomentum: { type: "number", format: "float" },
          extras: { type: "object" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      Forbidden: {
        description: "Insufficient permissions",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      RateLimitExceeded: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
        headers: {
          "X-RateLimit-Limit": {
            schema: { type: "integer" },
          },
          "X-RateLimit-Remaining": {
            schema: { type: "integer" },
          },
          "X-RateLimit-Reset": {
            schema: { type: "integer" },
          },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Keywords", description: "Keyword search and intelligence" },
    { name: "Watchlists", description: "Watchlist management" },
    { name: "Insights", description: "Trends and analytics" },
    { name: "Listings", description: "Listing intelligence" },
    { name: "AI", description: "AI-powered operations" },
    { name: "Auth", description: "Authentication" },
    { name: "Admin", description: "Administration" },
  ],
};

/**
 * Generate full OpenAPI spec with all documented routes
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const spec = { ...baseSpec };

  // Add documented API routes
  // In a full implementation, this would scan JSDoc comments
  // For now, we'll add key endpoints manually

  spec.paths["/api/keywords/search"] = {
    post: {
      summary: "Search keywords",
      description: "Search for keywords using semantic similarity and filters",
      tags: ["Keywords"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
                limit: { type: "integer", default: 50 },
                filters: {
                  type: "object",
                  properties: {
                    minDemand: { type: "number" },
                    maxCompetition: { type: "number" },
                  },
                },
              },
              required: ["query"],
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  keywords: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Keyword" },
                  },
                },
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/NotFound" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "429": { $ref: "#/components/responses/RateLimitExceeded" },
      },
    },
  };

  spec.paths["/api/status"] = {
    get: {
      summary: "API status",
      description: "Get API health status",
      tags: ["System"],
      security: [],
      responses: {
        "200": {
          description: "API is healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  version: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
  };

  return spec;
}
