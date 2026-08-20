import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, isSecureRequest } from "@/lib/auth";
import { badRequest, serverError } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  // Debug logging (no password, ever) — added to diagnose "login
  // doesn't work on my phone"-style reports, where the failure is
  // silent client-side (a 200 response whose cookie the browser then
  // drops) and otherwise invisible without server-side logs. `secure`
  // is the specific thing to watch: if it's `true` while the request
  // itself came in over plain HTTP, that mismatch is exactly the bug
  // isSecureRequest's own doc comment describes.
  const secure = isSecureRequest(req);
  const logCtx = {
    protocol: req.nextUrl.protocol,
    forwardedProto: req.headers.get("x-forwarded-proto"),
    host: req.headers.get("host"),
    userAgent: req.headers.get("user-agent"),
    secure,
  };

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      console.warn("[auth/login] rejected: missing email/password", logCtx);
      return badRequest("Email en wachtwoord zijn verplicht");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn("[auth/login] rejected: no user for email", { ...logCtx, email });
      return NextResponse.json(
        { error: "Ongeldig email of wachtwoord" },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.warn("[auth/login] rejected: bad password", { ...logCtx, email, userId: user.id });
      return NextResponse.json(
        { error: "Ongeldig email of wachtwoord" },
        { status: 401 },
      );
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
    response.cookies.set("rentflow_token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    console.log("[auth/login] success", { ...logCtx, email, userId: user.id });
    return response;
  } catch (err) {
    console.error("[auth/login] error", { ...logCtx, message: (err as Error).message });
    return serverError((err as Error).message);
  }
}
