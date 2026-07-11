import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { storeDocument, listDocuments } from "@/lib/documents";

type Params = { params: Promise<{ id: string }> };

const MAX_SIZE = 10 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const docs = await listDocuments(parseInt(id));
    return NextResponse.json(docs);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const label = formData.get("label") as string | null;
    const expiresAt = formData.get("expiresAt") as string | null;

    if (!file) return badRequest("Geen bestand ontvangen");
    if (file.type !== "application/pdf") return badRequest("Alleen PDF-bestanden zijn toegestaan");
    if (file.size > MAX_SIZE) return badRequest("Bestand is te groot (max. 10 MB)");

    const buffer = new Uint8Array(await file.arrayBuffer() as ArrayBuffer);
    const docId = await storeDocument({
      personId: parseInt(id),
      filename: file.name,
      label: label || null,
      mimeType: file.type,
      sizeBytes: file.size,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }, buffer);

    return NextResponse.json({ id: docId });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
