export type QuoteErrorCode =
  | "NOT_FOUND"
  | "NOT_A_QUOTE"
  | "NO_CLIENT"
  | "WRONG_STATUS"
  | "PROJECT_CANCELLED"
  | "ALREADY_ACCEPTED"
  | "OVERBOOK"
  | "NOT_ACCEPTED"
  | "ALREADY_CONVERTED"
  | "NO_DEPOSIT";

/** A refused quote action, with a code the route maps to a status. */
export class QuoteError extends Error {
  code: QuoteErrorCode;
  /** Open shortages, for an OVERBOOK refusal — the UI lists them. */
  shortages?: unknown;
  constructor(code: QuoteErrorCode, message: string, shortages?: unknown) {
    super(message);
    this.code = code;
    this.shortages = shortages;
  }
}
