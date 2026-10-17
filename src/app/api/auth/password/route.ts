import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSecureRequest } from "@/lib/auth";
import { BCRYPT_COST } from "@/lib/auth-config";
import { attachSession } from "@/lib/session";
import { requireAuth, badRequest, unauthorized, serverError } from "@/lib/api-auth";

// Self-service password change. Bumps tokenVersion so every other session
// (a stolen cookie, a forgotten device) is revoked; this one gets a fresh
// cookie so the caller stays logged in.
export async function POST(req: NextRequest) {
  const payload = await requireAuth().catch(() => null);
  if (!payload) return unauthorized();

  try {
    const { currentPassword, newPassword } = await req.json();
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return badRequest("Huidig en nieuw wachtwoord zijn verplicht");
    }
    if (newPassword.length < 8) {
      return badRequest("Wachtwoord moet minimaal 8 tekens zijn");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return unauthorized();
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return badRequest("Huidig wachtwoord is onjuist");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, BCRYPT_COST),
        tokenVersion: { increment: 1 },
      },
    });
    const response = NextResponse.json({ success: true });
    attachSession(response, updated, isSecureRequest(req));
    return response;
  } catch (err) {
    return serverError((err as Error).message);
  }
}
