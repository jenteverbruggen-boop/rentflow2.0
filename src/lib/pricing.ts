import { differenceInCalendarDays } from "date-fns";
import type { Period, PeriodPerson, PeriodStockItem, Project } from "@/types";

type PriceCarrier = Pick<Project, "materialPrices" | "personPrices">;

export function effectiveMaterialPriceFromProject(project: PriceCarrier, materialId: number, fallback: number): number {
  const override = project.materialPrices.find((p) => p.materialId === materialId);
  return override ? override.dayPrice : fallback;
}

export function effectivePersonPriceFromProject(project: PriceCarrier, personId: number, fallback: number): number {
  const override = project.personPrices.find((p) => p.personId === personId);
  return override ? override.dayPrice : fallback;
}

export function periodDays(period: Pick<Period, "startDate" | "endDate">): number {
  const days = differenceInCalendarDays(new Date(period.endDate), new Date(period.startDate)) + 1;
  return Math.max(1, days);
}

export function lineCost(
  snapshot: number,
  days: number,
  discount: { discountPct?: number | null; discountAmount?: number | null }
): number {
  const gross = snapshot * days;
  let net = gross;
  if (discount.discountPct != null) {
    net = gross * (1 - discount.discountPct / 100);
  } else if (discount.discountAmount != null) {
    net = gross - discount.discountAmount;
  }
  return Math.max(0, Math.round(net * 100) / 100);
}

export function materialLineCost(line: PeriodStockItem, days: number): number {
  return lineCost(line.dayPriceSnapshot, days, line);
}

export function personLineCost(line: PeriodPerson, days: number): number {
  return lineCost(line.dayPriceSnapshot, days, line);
}

export function periodTotal(period: Period): number {
  const days = periodDays(period);
  const mats = period.materials.reduce((acc, l) => acc + materialLineCost(l, days), 0);
  const pers = period.people.reduce((acc, l) => acc + personLineCost(l, days), 0);
  return Math.round((mats + pers) * 100) / 100;
}

export function projectTotal(periods: Period[]): number {
  return Math.round(periods.reduce((acc, p) => acc + periodTotal(p), 0) * 100) / 100;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(amount);
}
