import { z } from "zod";

export const NO_SECTION = "__none__";

export const addLineSchema = z
  .object({
    kind: z.enum(["manual", "text"]),
    description: z.string().trim().min(1, "Verplicht").max(2000, "Maximaal 2000 tekens"),
    quantity: z.string(),
    unit: z.enum(["dag", "uur", "stuk"]),
    unitPrice: z.string(),
    vatRate: z.string(),
    section: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "manual") return;
    if (!(Number(v.quantity) > 0)) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Groter dan 0" });
    if (v.unitPrice.trim() === "" || !Number.isFinite(Number(v.unitPrice))) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Geef een bedrag in" });
    }
  });
export type AddLineFormValues = z.infer<typeof addLineSchema>;

export const EMPTY: AddLineFormValues = { kind: "manual", description: "", quantity: "1", unit: "stuk", unitPrice: "", vatRate: "21", section: NO_SECTION };
