import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { logger } from "@/lib/log";

/** Uniform error handling for API route handlers. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Ongeldige invoer", details: error.flatten() },
      { status: 400 }
    );
  }
  logger.error("api.unhandled_error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return NextResponse.json({ error: "Er is iets misgegaan" }, { status: 500 });
}
