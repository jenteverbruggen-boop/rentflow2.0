import { prisma } from "@/lib/prisma";
import type { PersonDocument } from "@/types";

interface StoreArgs {
  personId: number;
  filename: string;
  label?: string | null;
  mimeType: string;
  sizeBytes: number;
  expiresAt?: Date | null;
}

export async function storeDocument(args: StoreArgs, buffer: Uint8Array<ArrayBuffer>): Promise<number> {
  const doc = await prisma.personDocument.create({
    data: { ...args, data: buffer },
    select: { id: true },
  });
  return doc.id;
}

export async function getDocument(id: number): Promise<{ meta: PersonDocument; data: Uint8Array } | null> {
  const doc = await prisma.personDocument.findUnique({ where: { id } });
  if (!doc) return null;
  const meta: PersonDocument = {
    id: doc.id, personId: doc.personId, filename: doc.filename, label: doc.label,
    mimeType: doc.mimeType, sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt.toISOString(), expiresAt: doc.expiresAt?.toISOString() ?? null,
  };
  return { meta, data: new Uint8Array(doc.data) };
}

export async function listDocuments(personId: number): Promise<PersonDocument[]> {
  const docs = await prisma.personDocument.findMany({
    where: { personId },
    select: { id: true, personId: true, filename: true, label: true, mimeType: true, sizeBytes: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return docs.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
  }));
}

export async function deleteDocument(id: number): Promise<void> {
  await prisma.personDocument.delete({ where: { id } });
}
