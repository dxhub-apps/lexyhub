/**
 * Sentry Configuration for Background Jobs
 *
 * Initialize Sentry for standalone background jobs that run outside of Next.js.
 * This ensures errors in background jobs are tracked and monitored.
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

let initialized = false;

/**
 * Initialize Sentry for background jobs
 *
 * Call this at the start of any background job script.
 *
 * @example
 * import { initSentryForJob } from '@/lib/monitoring/sentry-jobs';
 *
 * async function main() {
 *   initSentryForJob('etsy-ingest');
 *   // ... job logic
 * }
 */
export function initSentryForJob(jobName: string) {
  if (initialized) {
    return;
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn("Sentry DSN not configured, skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Integrations for Node.js
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
      Sentry.prismaIntegration(),
      Sentry.postgresIntegration(),
    ],

    // Set job context
    initialScope: {
      tags: {
        job_name: jobName,
        job_type: "background",
      },
    },

    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  initialized = true;
}

/**
 * Wrap a job function with Sentry transaction tracking
 *
 * @example
 * import { wrapJobWithSentry } from '@/lib/monitoring/sentry-jobs';
 *
 * const job = wrapJobWithSentry('etsy-ingest', async () => {
 *   // ... job logic
 * });
 *
 * await job();
 */
export function wrapJobWithSentry<T>(
  jobName: string,
  jobFunction: () => Promise<T>
): () => Promise<T> {
  return async () => {
    // Initialize Sentry if not already done
    initSentryForJob(jobName);

    // Run the job within a Sentry transaction
    return await Sentry.startSpan(
      {
        name: jobName,
        op: "job",
      },
      async () => {
        try {
          const result = await jobFunction();
          return result;
        } catch (error) {
          // Capture the error in Sentry
          Sentry.captureException(error, {
            tags: {
              job_name: jobName,
            },
          });
          throw error;
        }
      }
    );
  };
}

/**
 * Capture a checkpoint/progress update for a long-running job
 *
 * @example
 * captureJobCheckpoint('etsy-ingest', 'processed_batch', {
 *   batch: 5,
 *   total: 10,
 * });
 */
export function captureJobCheckpoint(
  jobName: string,
  checkpoint: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: "job.checkpoint",
    message: `${jobName}: ${checkpoint}`,
    data,
    level: "info",
  });
}

/**
 * Flush pending Sentry events before exiting
 *
 * Call this at the end of your job to ensure all events are sent.
 *
 * @example
 * await flushSentry();
 * process.exit(0);
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!initialized) {
    return true;
  }

  return await Sentry.close(timeout);
}
