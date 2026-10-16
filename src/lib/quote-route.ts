import { NextResponse } from "next/server";
import { QuoteError } from "@/lib/quote-error";
import { DraftNotMutableError } from "@/lib/invoices";
import { badRequest, conflict, notFound, serverError } from "@/lib/api-auth";

/** Maps a refused quote action to its HTTP response. */
export function quoteErrorResponse(err: unknown): NextResponse {
  if (err instanceof QuoteError) {
    if (err.code === "NOT_FOUND") return notFound();
    if (err.code === "NOT_A_QUOTE" || err.code === "NO_CLIENT") return badRequest(err.message);
    return conflict(err.message, err.shortages ? { shortages: err.shortages } : undefined);
  }
  if (err instanceof DraftNotMutableError) return conflict(err.message);
  return serverError((err as Error).message);
}
