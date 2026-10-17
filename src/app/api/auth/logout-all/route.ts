import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSecureRequest } from "@/lib/auth";
import { attachSession } from "@/lib/session";
import { requireAuth, unauthorized, serverError } from "@/lib/api-auth";

// Revokes every session of the caller (all devices) by bumping tokenVersion;
// the current browser gets a fresh cookie so it stays logged in.
export async function POST(req: NextRequest) {
  const payload = await requireAuth().catch(() => null);
  if (!payload) return unauthorized();

  try {
    const updated = await prisma.user.update({
      where: { id: payload.id },
      data: { tokenVersion: { increment: 1 } },
    });
    const response = NextResponse.json({ success: true });
    attachSession(response, updated, isSecureRequest(req));
    return response;
  } catch (err) {
    return serverError((err as Error).message);
  }
}
