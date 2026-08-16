import type { PrismaClient } from "@/generated/prisma/client";
import { projectInclude } from "@/lib/project-include";
import { serializeProject } from "@/lib/serialize-project";
import { generateDraftInvoiceLines, type DraftInvoiceLine } from "@/lib/invoice-lines";
import { computeInvoiceTotals, type InvoiceTotals } from "@/lib/invoice-totals";
import { loadPriorDeposits } from "@/lib/invoice-prior-deposits";
import { projectCostSummary } from "@/lib/pricing";
import type { Period, InvoiceRole, DepositType } from "@/types";

export interface BuildInvoiceDraftArgs {
  projectId: number;
  invoiceRole: InvoiceRole;
  depositType?: DepositType;
  depositValue?: number;
}

export interface BuiltInvoiceDraft {
  project: { id: number; name: string; clientRel: { id: number; name: string; address: string | null; postalCode: string | null; city: string | null; vatNumber: string | null } | null };
  lines: DraftInvoiceLine[];
  totals: InvoiceTotals;
  depositBasisExcl: number | null;
}

/**
 * J2b.2/J2b.4 — regenerates from the live project (design doc §7's
 * `POST /api/invoices/:id/regenerate` and `createDraftInvoice` share
 * this exact computation, extracted so neither reimplements it).
 * Never touches the DB beyond the read — no `invoice.create`/`update`
 * here, callers own persistence.
 */
export async function buildInvoiceDraft(
  args: BuildInvoiceDraftArgs,
  client: PrismaClient,
): Promise<BuiltInvoiceDraft | null> {
  const project = await client.project.findUnique({
    where: { id: args.projectId },
    include: projectInclude,
  });
  if (!project) return null;

  const serialized = serializeProject(project);
  // serializeProject() leaves date fields as native Date objects — see
  // create-draft-invoice.ts's own comment on this cast; every date this
  // function reads through only ever does `new Date(x)`, runtime-safe
  // regardless of whether it's already a Date or an ISO string.
  const periods = serialized.periods as unknown as Period[];

  // Read through the passed-in client, not getSettings()'s own default
  // singleton — this function is called from inside regenerateInvoice's
  // transaction, and a nested query on a different connection would
  // deadlock SQLite's single-connection dev/test setup (a real bug this
  // codebase already hit once, in invoice-lines-crud.ts's addManualLine).
  const btwRateSetting = await client.setting.findUnique({ where: { key: "btwRate" } });
  const vatRate = Number(btwRateSetting?.value || "21");
  const priorDeposits =
    args.invoiceRole === "final"
      ? await loadPriorDeposits(client, args.projectId, vatRate)
      : undefined;

  const lines = generateDraftInvoiceLines(periods, {
    invoiceRole: args.invoiceRole,
    vatRate,
    depositType: args.depositType,
    depositValue: args.depositValue,
    priorDeposits,
    projectLabel: `project #${project.id} — ${project.name}`,
  });
  const totals = computeInvoiceTotals(lines);
  const depositBasisExcl =
    args.invoiceRole === "deposit" ? projectCostSummary(periods).total : null;

  return { project, lines, totals, depositBasisExcl };
}
