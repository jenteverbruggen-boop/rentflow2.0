import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

export async function effectiveMaterialPrice(projectId: number, materialId: number): Promise<number> {
  const override = await prisma.projectMaterialPrice.findUnique({
    where: { projectId_materialId: { projectId, materialId } },
  });
  if (override) return toNumber(override.dayPrice);
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  return material ? toNumber(material.dayPrice) : 0;
}

export async function effectivePersonPrice(projectId: number, personId: number): Promise<number> {
  const override = await prisma.projectPersonPrice.findUnique({
    where: { projectId_personId: { projectId, personId } },
  });
  if (override) return toNumber(override.dayPrice);
  const person = await prisma.person.findUnique({ where: { id: personId } });
  return person ? toNumber(person.dayPrice) : 0;
}
