"use client";

import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "../../sentry.options";

Sentry.init(buildSentryOptions("client"));
