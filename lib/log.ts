import "server-only";
import { headers } from "next/headers";
import { forwardToDrains } from "@/lib/log-drain";

/**
 * Structured (JSON-lines-to-stdout) logging — the SIEM-facing layer that
 * sits alongside, not instead of, the existing business-level trail
 * (AuditLog, see lib/audit.ts). That one is relational rows meant for
 * this app's own screen (/backend/audit); this is the same events (plus
 * request/error noise) as one JSON object per line on stdout/stderr, in
 * the shape a log ingestion pipeline actually wants. Vercel forwards
 * every function's stdout/stderr to any configured Log Drain with zero
 * app-side code — that's the whole point of writing plain JSON lines
 * here rather than inventing a bespoke transport. lib/log-drain.ts adds
 * two optional, concrete, protocol-ready DIRECT sinks (HTTP webhook,
 * RFC 5424 syslog) for when Vercel's own Log Drains aren't available/used
 * and a customer's SOC needs a direct push instead — both off by default
 * until a real endpoint is configured.
 *
 * Levels: trace/debug/info/warning/error/fatal/security. SECURITY is its
 * own category, not a severity tier: it's for exactly the events a SOC
 * cares about (logins, MFA, datalek reports — see lib/audit.ts) and is
 * ALWAYS emitted regardless of LOG_LEVEL, so turning down verbosity to
 * cut noise can never silently drop a compliance-relevant event.
 */

export type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "fatal" | "security";

const LEVEL_ORDER: Record<Exclude<LogLevel, "security">, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warning: 3,
  error: 4,
  fatal: 5,
};

const DEFAULT_LEVEL: Exclude<LogLevel, "security"> = "info";

function configuredMinimumLevel(): Exclude<LogLevel, "security"> {
  const raw = (process.env.LOG_LEVEL ?? DEFAULT_LEVEL).toLowerCase();
  if (raw in LEVEL_ORDER) return raw as Exclude<LogLevel, "security">;
  return DEFAULT_LEVEL;
}

function shouldEmit(level: LogLevel): boolean {
  if (level === "security") return true;
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredMinimumLevel()];
}

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type LogRecord = {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  requestId?: string;
} & LogFields;

// Levels that warrant stderr (most log pipelines, Vercel included, tag
// these as "Error" severity in their own viewer) rather than stdout.
const STDERR_LEVELS = new Set<LogLevel>(["error", "fatal", "security"]);

/**
 * The `x-request-id` middleware.ts mints per request — this app's
 * equivalent of an OS process/thread ID, since a serverless deployment
 * has neither. Read via next/headers, which resolves correctly no matter
 * how deep in the call stack this runs within a real request — wrapped
 * defensively because the SAME call sites (logAudit, this file's own
 * tests) are also exercised directly, outside any HTTP request —
 * headers() then throws, and this must degrade to "no id" rather than
 * break the caller.
 */
async function currentRequestId(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

async function emit(level: LogLevel, message: string, fields: LogFields): Promise<void> {
  const requestId = await currentRequestId();
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "vezrap",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    requestId,
    // A field explicitly passed as `requestId` wins over the
    // auto-detected one — object spread order, last write wins.
    ...fields,
  };

  const line = JSON.stringify(record);
  if (STDERR_LEVELS.has(level)) {
    console.error(line);
  } else {
    console.log(line);
  }

  // Fire-and-forget: a SIEM being unreachable must never affect the
  // request this log line is describing — see lib/log-drain.ts.
  forwardToDrains(record);
}

// Public API stays synchronous/void on purpose — the async header lookup
// above runs detached, its own errors swallowed inside currentRequestId,
// never surfacing as an unhandled rejection.
export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (!shouldEmit(level)) return;
  emit(level, message, fields).catch(() => {});
}

export const logger = {
  trace: (message: string, fields?: LogFields) => log("trace", message, fields),
  debug: (message: string, fields?: LogFields) => log("debug", message, fields),
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warning: (message: string, fields?: LogFields) => log("warning", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
  fatal: (message: string, fields?: LogFields) => log("fatal", message, fields),
  /** Always emitted regardless of LOG_LEVEL — see this module's comment. */
  security: (message: string, fields?: LogFields) => log("security", message, fields),
};
