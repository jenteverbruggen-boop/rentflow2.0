import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { generateDraftInvoiceLines } from "@/lib/invoice-lines";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { loadPriorDeposits } from "@/lib/invoice-prior-deposits";
import { invoiceInclude } from "@/lib/serialize-invoice";
import { getSettings } from "@/lib/settings";
import { projectCostSummary } from "@/lib/pricing";
import type { Period, InvoiceRole, DepositType } from "@/types";

export interface CreateDraftInvoiceArgs {
  projectId: number;
  invoiceRole: InvoiceRole;
  depositType?: DepositType;
  depositValue?: number;
}

export class CreateDraftInvoiceError extends Error {
  code: "NOT_FOUND" | "NO_CLIENT";
  constructor(code: "NOT_FOUND" | "NO_CLIENT", message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * J2b.2 — the lib half of "create and store draft invoices" (design
 * doc §7's `POST /api/invoices`), split from the route so it can be
 * tested against a real DB the way M1.4's apply-material-import.ts is
 * (this codebase has no route-handler test convention — auth/cookies
 * make that awkward — so business logic lives in a lib function the
 * route thinly wraps).
 */
export async function createDraftInvoice(
  args: CreateDraftInvoiceArgs,
  client: PrismaClient = defaultPrisma,
) {
  const project = await client.project.findUnique({
    where: { id: args.projectId },
    include: projectInclude,
  });
  if (!project) throw new CreateDraftInvoiceError("NOT_FOUND", "Project niet gevonden");
  if (!project.clientRel) {
    throw new CreateDraftInvoiceError("NO_CLIENT", "Project heeft geen klant gekoppeld");
  }

  const serialized = serializeProject(project);
  // serializeProject() leaves date fields as native Date objects (its
  // only callers today hand the result straight to NextResponse.json(),
  // which stringifies at the wire boundary) — every date this function
  // reads through (periodDays, personLineCost, projectCostSummary) only
  // ever does `new Date(x)`, which accepts a Date exactly like an ISO
  // string, so this cast bridges a real runtime-safe type.
  const periods = serialized.periods as unknown as Period[];

  const settings = await getSettings();
  const vatRate = Number(settings.btwRate || "21");
  const priorDeposits =
    args.invoiceRole === "final"
      ? await loadPriorDeposits(client, args.projectId, vatRate)
      : undefined;

  const draftLines = generateDraftInvoiceLines(periods, {
    invoiceRole: args.invoiceRole,
    vatRate,
    depositType: args.depositType,
    depositValue: args.depositValue,
    priorDeposits,
    projectLabel: `project #${project.id} — ${project.name}`,
  });
  const totals = computeInvoiceTotals(draftLines);
  const depositBasisExcl =
    args.invoiceRole === "deposit" ? projectCostSummary(periods).total : null;

  return client.invoice.create({
    data: {
      invoiceRole: args.invoiceRole,
      projectId: project.id,
      clientId: project.clientRel.id,
      clientName: project.clientRel.name,
      clientAddress: project.clientRel.address,
      clientPostalCode: project.clientRel.postalCode,
      clientCity: project.clientRel.city,
      clientVatNumber: project.clientRel.vatNumber,
      depositType: args.invoiceRole === "deposit" ? (args.depositType ?? null) : null,
      depositPercentage:
        args.invoiceRole === "deposit" && args.depositType === "percentage"
          ? args.depositValue
          : null,
      depositBasisExcl,
      ...totals,
      lines: { create: draftLines },
    },
    include: invoiceInclude,
  });
}
