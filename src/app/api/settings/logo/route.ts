import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { getLogo, setLogo, deleteLogo } from "@/lib/settings";

const MAX_SIZE = 1 * 1024 * 1024;

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const logo = await getLogo();
    if (!logo) return new NextResponse(null, { status: 404 });
    return new NextResponse(logo.data.buffer as ArrayBuffer, {
      headers: { "Content-Type": logo.mime, "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return badRequest("Geen bestand ontvangen");
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) return badRequest("Alleen PNG of JPEG toegestaan");
    if (file.size > MAX_SIZE) return badRequest("Bestand is te groot (max. 1 MB)");
    const buffer = new Uint8Array(await file.arrayBuffer() as ArrayBuffer);
    await setLogo(buffer, file.type);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    await deleteLogo();
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
