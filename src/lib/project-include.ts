import type { Prisma } from "@/generated/prisma/client";

export const projectInclude = {
  clientRel: true,
  locationRel: true,
  periods: {
    orderBy: { startDate: "asc" },
    include: {
      materials: {
        include: {
          stockItem: {
            include: { material: { include: { categoryRel: true } } },
          },
        },
        orderBy: { id: "asc" },
      },
      people: {
        include: { person: true, travelCosts: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      },
      bundleBookings: {
        include: {
          material: { include: { components: { include: { child: true } } } },
        },
        orderBy: { id: "asc" },
      },
    },
  },
  materialPrices: { include: { material: true } },
  personPrices: { include: { person: true } },
} satisfies Prisma.ProjectInclude;
