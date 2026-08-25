import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

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
  console.error(error);
  return NextResponse.json({ error: "Er is iets misgegaan" }, { status: 500 });
}
