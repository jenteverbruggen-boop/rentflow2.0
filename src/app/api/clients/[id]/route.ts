import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { projects: true } } },
    });
    if (!client) return notFound();
    return NextResponse.json(client);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { email, ...rest } = parsed.data;
    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: { ...rest, email: email || null },
    });
    return NextResponse.json(client);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const count = await prisma.project.count({
      where: { clientId: parseInt(id) },
    });
    if (count > 0) {
      return conflict(
        "Klant kan niet verwijderd worden: er zijn nog projecten gekoppeld.",
      );
    }
    await prisma.client.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
