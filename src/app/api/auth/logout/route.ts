import { NextRequest, NextResponse } from "next/server";
import { isSecureRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("rentflow_token", "", {
    httpOnly: true,
    // Must match login's own decision (isSecureRequest) — a Secure
    // mismatch between the cookie that was actually set and the one
    // used to clear it risks the browser not overwriting/clearing it.
    secure: isSecureRequest(req),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
