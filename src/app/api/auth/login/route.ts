import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSecureRequest } from "@/lib/auth";
import { BCRYPT_COST } from "@/lib/auth-config";
import { attachSession, clientIp } from "@/lib/session";
import { badRequest, serverError } from "@/lib/api-auth";

// Compared against when the email is unknown so both failure paths cost one
// bcrypt run — response time must not reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("rentflow-dummy-password", BCRYPT_COST);

const invalid = () =>
  NextResponse.json({ error: "Ongeldig email of wachtwoord" }, { status: 401 });

export async function POST(req: NextRequest) {
  const secure = isSecureRequest(req);
  const ip = clientIp(req);

  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return badRequest("Email en wachtwoord zijn verplicht");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      console.warn("[auth/login] rejected", { ip, userId: user?.id ?? null });
      return invalid();
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    attachSession(response, user, secure);
    console.log("[auth/login] success", { ip, userId: user.id, secure });
    return response;
  } catch (err) {
    console.error("[auth/login] error", { ip, message: (err as Error).message });
    return serverError((err as Error).message);
  }
}
