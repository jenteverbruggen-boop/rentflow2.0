import type { Prisma } from "@prisma/client";

export const projectInclude = {
  periods: {
    orderBy: { startDate: "asc" },
    include: {
      materials: {
        include: { stockItem: { include: { material: true } } },
        orderBy: { id: "asc" },
      },
      people: {
        include: { person: true },
        orderBy: { id: "asc" },
      },
    },
  },
  materialPrices: { include: { material: true } },
  personPrices: { include: { person: true } },
} satisfies Prisma.ProjectInclude;
