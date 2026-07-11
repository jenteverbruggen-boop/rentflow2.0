import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, notFound, serverError } from "@/lib/api-auth";
import { getDocument, deleteDocument } from "@/lib/documents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const doc = await getDocument(parseInt(id));
    if (!doc) return notFound();
    return new NextResponse(doc.data.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": doc.meta.mimeType,
        "Content-Disposition": `inline; filename="${doc.meta.filename}"`,
      },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    await deleteDocument(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
