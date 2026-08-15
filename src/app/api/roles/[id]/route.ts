import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  label: z.string().min(1, "Naam is verplicht").optional(),
  scope: z.enum(["all", "own"]).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireModule("gebruikers", "wijzigen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    if (parsed.data.label === undefined && parsed.data.scope === undefined) {
      return badRequest("Geen wijzigingen opgegeven");
    }

    const role = await prisma.role.findUnique({ where: { id: parseInt(id) } });
    if (!role) return notFound();
    // isSystem roles are renameable and their scope is editable too — only
    // key is immutable, and this route never accepts key at all, so no
    // extra branch is needed here.
    const updated = await prisma.role.update({
      where: { id: parseInt(id) },
      data: {
        ...(parsed.data.label !== undefined && { label: parsed.data.label }),
        ...(parsed.data.scope !== undefined && { scope: parsed.data.scope }),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireModule("gebruikers", "verwijderen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return notFound();
    // Enforced server-side, not only via a disabled UI control — a direct
    // API call must also be rejected.
    if (role.isSystem) {
      return conflict("Systeemrollen (Admin/Planner/Viewer) kunnen niet verwijderd worden.");
    }
    // Checked against User.roleId, not RolePermission — a role can carry
    // matrix entries with zero users assigned, which should be freely
    // deletable.
    if (role._count.users > 0) {
      return conflict(
        "Rol kan niet verwijderd worden: er zijn nog gebruikers gekoppeld.",
      );
    }
    await prisma.role.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
