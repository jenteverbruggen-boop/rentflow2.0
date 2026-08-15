import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { getDocument, deleteDocument } from "@/lib/documents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const doc = await getDocument(parseInt(id));
    if (!doc) return notFound();
    // scope: own may read their own attesten only — see the identical
    // note in people/[id]/documents/route.ts.
    if (access.scope === "own" && access.personId !== doc.meta.personId) {
      return forbidden();
    }
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
  const access = await requireModule("personen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    await deleteDocument(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
