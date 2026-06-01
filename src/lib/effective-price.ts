import { prisma } from "@/lib/prisma";

export async function effectiveMaterialPrice(projectId: number, materialId: number): Promise<number> {
  const override = await prisma.projectMaterialPrice.findUnique({
    where: { projectId_materialId: { projectId, materialId } },
  });
  if (override) return Number(override.dayPrice);
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  return material ? Number(material.dayPrice) : 0;
}

export async function effectivePersonPrice(projectId: number, personId: number): Promise<number> {
  const override = await prisma.projectPersonPrice.findUnique({
    where: { projectId_personId: { projectId, personId } },
  });
  if (override) return Number(override.dayPrice);
  const person = await prisma.person.findUnique({ where: { id: personId } });
  return person ? Number(person.dayPrice) : 0;
}
