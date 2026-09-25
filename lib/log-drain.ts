import "server-only";
import { connect as tcpConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { createSocket } from "node:dgram";
import type { LogRecord } from "@/lib/log";

/**
 * Two concrete, ready-to-point-at-a-real-endpoint SIEM sinks, both off by
 * default (no-op until their env vars are set) — see lib/log.ts's module
 * comment for why these exist ALONGSIDE, not instead of, the stdout JSON
 * lines Vercel's own Log Drains feature already forwards with zero app
 * code. These are for the case where a customer's SOC needs a direct
 * push instead (or their hosting plan doesn't support Log Drains).
 *
 * Which of these two — or neither, if Vercel's native Log Drains covers
 * it — gets used depends on which SIEM/protocol a given deployment's SOC
 * actually runs. Both are complete, real implementations (not stubs) so
 * switching one on is a matter of setting environment variables, not
 * writing code.
 *
 * Every function here is fire-and-forget and swallows its own failures: a
 * SIEM endpoint being down, slow, or misconfigured must never affect (or
 * even slow down) the request the log line is describing.
 */

const FETCH_TIMEOUT_MS = 5000;
const SOCKET_TIMEOUT_MS = 3000;

export function forwardToDrains(record: LogRecord): void {
  forwardToWebhook(record).catch(() => {});
  forwardToSyslog(record).catch(() => {});
}

// --- HTTP webhook sink -------------------------------------------------
// Covers the large majority of real SIEM/SOC HTTP collectors (Splunk
// HTTP Event Collector, Microsoft Sentinel's Logs Ingestion API, Elastic,
// Datadog, Graylog's HTTP GELF input, or a generic webhook relay) — the
// exact auth header/scheme varies per product, so both are configurable
// rather than hardcoded to one vendor's convention.
async function forwardToWebhook(record: LogRecord): Promise<void> {
  const url = process.env.SIEM_WEBHOOK_URL;
  if (!url) return;

  const headerName = process.env.SIEM_WEBHOOK_HEADER || "Authorization";
  const headerPrefix = process.env.SIEM_WEBHOOK_HEADER_PREFIX ?? "Bearer ";
  const token = process.env.SIEM_WEBHOOK_TOKEN;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers[headerName] = `${headerPrefix}${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
      signal: controller.signal,
    });
  } catch {
    // Deliberately silent — see this module's comment. Whoever operates
    // this deployment sees delivery failures in the SIEM/collector's own
    // monitoring, not here.
  } finally {
    clearTimeout(timeout);
  }
}

// --- Syslog (RFC 5424) sink --------------------------------------------
// Covers SIEM/SOC platforms that ingest via syslog (QRadar, Graylog,
// rsyslog-fed collectors) — a new TCP/TLS/UDP connection per line rather
// than a held-open socket, which is the right call in a serverless
// runtime where an invocation's process may not exist by the time a
// "later" line would reuse it.
const SYSLOG_SEVERITY: Record<LogRecord["level"], number> = {
  fatal: 2, // Critical
  error: 3, // Error
  security: 5, // Notice — RFC 5424 has no "security" severity; Notice
  // ("normal but significant") is the closest fit, and the structured-data
  // element below still tags level="security" explicitly so a SIEM's own
  // rule engine can filter/promote these regardless of numeric severity.
  warning: 4, // Warning
  info: 6, // Informational
  debug: 7, // Debug
  trace: 7, // Debug
};

function sdParamEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/]/g, "\\]");
}

/**
 * Builds one RFC 5424 syslog message. The private structured-data element
 * uses IANA's own PEN 32473 ("example"/documentation enterprise number,
 * the one RFC 5424's own examples use) as a placeholder — swap it for a
 * real registered PEN in SIEM_SYSLOG_ENTERPRISE_ID if a customer's SOC
 * requires one; most syslog receivers don't actually validate the PEN
 * against IANA's registry, they just treat the SD-ID as an opaque
 * namespace. The full JSON record is ALSO included as the free-text MSG
 * part, for receivers that parse the message body rather than
 * structured-data (the more common case in practice).
 */
export function buildSyslogMessage(record: LogRecord, hostname: string): string {
  const facility = Number(process.env.SIEM_SYSLOG_FACILITY ?? 16); // local0
  const severity = SYSLOG_SEVERITY[record.level];
  const pri = facility * 8 + severity;
  const enterpriseId = process.env.SIEM_SYSLOG_ENTERPRISE_ID || "32473";
  const version = 1;
  const timestamp = record.timestamp;
  const appName = record.service;
  const procId = "-";
  const msgId = record.level.toUpperCase().slice(0, 32);
  const structuredData = `[vezrap@${enterpriseId} level="${sdParamEscape(record.level)}" environment="${sdParamEscape(record.environment)}"]`;
  const msg = JSON.stringify(record);
  return `<${pri}>${version} ${timestamp} ${hostname} ${appName} ${procId} ${msgId} ${structuredData} ${msg}`;
}

async function forwardToSyslog(record: LogRecord): Promise<void> {
  const host = process.env.SIEM_SYSLOG_HOST;
  if (!host) return;

  const port = Number(process.env.SIEM_SYSLOG_PORT ?? 601); // 601 = the IANA-assigned RFC 5424 syslog-conn port
  const protocol = (process.env.SIEM_SYSLOG_PROTOCOL || "tcp").toLowerCase();
  const useTls = process.env.SIEM_SYSLOG_TLS === "true";
  const hostname = process.env.VERCEL_URL || "vezrap";

  // Syslog framing requires a length-prefixed (octet-counting, RFC 6587)
  // message on a stream transport so the receiver can tell where one
  // message ends and the next begins on a shared connection — moot here
  // since each message gets its own fresh connection, but still the
  // correct, spec-compliant framing to send.
  const message = buildSyslogMessage(record, hostname);
  const framed = `${Buffer.byteLength(message, "utf8")} ${message}`;

  if (protocol === "udp") {
    await sendUdp(host, port, framed);
    return;
  }
  await sendTcp(host, port, framed, useTls);
}

function sendTcp(host: string, port: number, framed: string, useTls: boolean): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => resolve();
    const socket = useTls
      ? tlsConnect({ host, port, timeout: SOCKET_TIMEOUT_MS })
      : tcpConnect({ host, port, timeout: SOCKET_TIMEOUT_MS });
    socket.once("connect", () => {
      socket.write(framed, () => socket.end());
    });
    socket.once("error", finish);
    socket.once("timeout", () => {
      socket.destroy();
      finish();
    });
    socket.once("close", finish);
  });
}

function sendUdp(host: string, port: number, framed: string): Promise<void> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const finish = () => {
      socket.close();
      resolve();
    };
    socket.send(framed, port, host, finish);
    socket.once("error", finish);
  });
}
