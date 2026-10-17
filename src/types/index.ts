export type ProjectStatus =
  | "concept"
  | "bevestigd"
  | "actief"
  | "afgerond"
  | "geannuleerd";

export type ModuleKey =
  | "projecten"
  | "planning"
  | "personen"
  | "materialen"
  | "klanten"
  | "locaties"
  | "kosten_facturen"
  | "cijfers"
  | "gebruikers"
  | "instellingen"
  | "notities";

export type AccessLevel = "geen" | "lezen" | "wijzigen" | "verwijderen";

export interface User {
  id: number;
  email: string;
  name: string;
  roleId: number;
  roleRel: { id: number; key: string; label: string; scope: "all" | "own" };
  personId: number | null;
  person: { name: string } | null;
  createdAt: string;
}

export interface Client {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
  notes: string | null;
  functionRates?: ClientFunctionRate[];
  _count?: { projects: number };
}

export interface ClientFunctionRate {
  id: number;
  clientId: number;
  functionId: number;
  dayRate: number | null;
  hourRate: number | null;
  function?: Function;
}

export interface Location {
  id: number;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  notes: string | null;
  _count?: { projects: number };
}

export interface Function {
  id: number;
  name: string;
  dayRate: number | null;
  hourRate: number | null;
  archived?: boolean;
  _count?: { people: number; assignments: number; clientRates: number };
}

export interface PersonFunction {
  personId: number;
  functionId: number;
  dayRate: number | null;
  hourRate: number | null;
  function?: Function;
}

export interface Category {
  id: number;
  name: string;
  prefix: string;
}

export interface Setting {
  key: string;
  value: string | null;
}

export interface Person {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  dayPrice: number | null;
  functions?: PersonFunction[];
}

export interface MaterialComponent {
  id: number;
  parentId: number;
  childId: number;
  quantity: number;
  child?: Material;
}

export interface BundleStockComponentInput {
  childId: number;
  name: string;
  code: string | null;
  needPerSet: number;
  totalStock: number;
  dayPrice: number;
  sharedWith?: { id: number; name: string }[];
}

export interface BundleStockComponent extends BundleStockComponentInput {
  usedInComplete: number;
  remaining: number;
  haveForNext: number;
  missingForNext: number;
}

export interface BundleStock {
  completeSets: number;
  hasIncomplete: boolean;
  componentSum: number;
  components: BundleStockComponent[];
}

export interface PeriodBundleBooking {
  id: number;
  periodId: number;
  materialId: number;
  quantity: number;
  dayPriceSnapshot: number | null;
  material?: Material & { components?: MaterialComponent[] };
}

export interface Material {
  id: number;
  name: string;
  category: string | null;
  categoryId: number | null;
  categoryRel?: Category | null;
  code: string | null;
  notes: string | null;
  dayPrice: number | null;
  setupCost: number | null;
  isBundle: boolean;
  bundlePriceOverride: number | null;
  archived: boolean;
  costPrice: number | null;
  listPrice: number | null;
  revenueBefore: number | null;
  /** C3 — hiring in. `subhireUnitCost` is purchase price (money). */
  defaultSupplierId?: number | null;
  subhireUnitCost?: number | null;
  subhireCostBasis?: SubhireCostBasis;
  subhireOnly?: boolean;
  /** E1 — per day (default) or once per rental. */
  priceBasis?: PriceBasis;
  components?: MaterialComponent[];
  stockItems?: StockItem[];
  totalStock?: number;
  bundleStock?: BundleStock;
  setPrice?: number | null;
  usedInSets?: { id: number; name: string; quantity: number }[];
}

export interface PersonDocument {
  id: number;
  personId: number;
  filename: string;
  label: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface StockItem {
  id: number;
  materialId: number;
  unitNumber: number;
  identifier: string | null;
  notes: string | null;
  costPrice: number | null;
  material?: Material;
  assignments?: StockItemAssignment[];
}

export interface StockBulkAddResult {
  added: number;
  fromUnit: number;
  toUnit: number;
}

export interface StockBulkRemoveResult {
  removed: number;
  removedUnits: number[];
}

export interface StockBulkConflict {
  error: string;
  blockedUnits: number[];
  /** Free units across the whole material (informational). */
  removable: number;
  /** Largest count a highest-first removal would actually accept —
   * always use this for a "remove the maximum" affordance. */
  removableFromTop: number;
}

export interface StockItemAssignment {
  id: number;
  periodId: number;
  dayPriceSnapshot: number | null;
  setupCostSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  period: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    project: {
      id: number;
      name: string;
      status: ProjectStatus;
      location: string | null;
    };
  };
}

/** Overboeken — a period wants N units of a material that don't exist as
 * a PeriodStockItem (flat shortfall), or N components missing inside a
 * set booking (`bundleBookingId` set). See src/lib/material-shortage.ts. */
export type SubhireCostBasis = "per_huur" | "per_dag";

/** What the client pays for a material: per day or once per rental. */
export type PriceBasis = "per_dag" | "per_huur";

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
  notes: string | null;
  archived: boolean;
}

export interface PeriodMaterialShortage {
  id: number;
  periodId: number;
  materialId: number;
  quantity: number;
  bundleBookingId: number | null;
  dayPriceSnapshot: number;
  setupCostSnapshot: number;
  discountPct: number | null;
  discountAmount: number | null;
  priceBasisSnapshot?: PriceBasis;
  /** C3 — set once the missing units are hired in; the row is then resolved
   * (no longer open) but stays billed to the client. */
  supplierId?: number | null;
  supplier?: { id: number; name: string } | null;
  subhireCostBasis?: SubhireCostBasis | null;
  subhireUnitCost?: number | null;
  subhireCostOverride?: number | null;
  subhiredAt?: string | null;
  material: Material;
}

export interface PeriodStockItem {
  id: number;
  periodId: number;
  stockItemId: number;
  dayPriceSnapshot: number | null;
  setupCostSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  bundleBookingId: number | null;
  /** Basis the price was booked on (absent = per day). */
  priceBasisSnapshot?: PriceBasis;
  /** Packing-list checklist — set when an operator ticks a unit as
   * loaded/unloaded; `null` means "not yet". `returnedAt` is only ever
   * meaningful once `shippedAt` is set (checked server-side). */
  shippedAt: string | null;
  returnedAt: string | null;
  stockItem: StockItem & { material: Material };
}

export interface PersonTravelCost {
  id: number;
  periodPersonId: number;
  label: string | null;
  unitCost: number;
  quantity: number;
}

/** H6 — one selected day (or part of a day) of a person's assignment.
 * An assignment with no `days` covers its whole period, exactly as
 * before H6. */
export interface AssignmentDay {
  id: number;
  periodPersonId: number;
  startAt: string;
  endAt: string;
}

export interface PeriodPerson {
  id: number;
  periodId: number;
  personId: number;
  functionId: number | null;
  /** The assignment's envelope: its own window (H1.3), or the earliest
   * start / latest end of its `days` (H6), or null for "whole period". */
  startAt: string | null;
  endAt: string | null;
  days?: AssignmentDay[];
  overlapAck: boolean;
  billingUnit: "dag" | "uur";
  rateSnapshot: number | null;
  dayPriceSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  person: Person;
  function?: Function | null;
  travelCosts?: PersonTravelCost[];
}

export interface Period {
  id: number;
  projectId: number;
  name: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
  materials: PeriodStockItem[];
  people: PeriodPerson[];
  bundleBookings?: PeriodBundleBooking[];
  shortages?: PeriodMaterialShortage[];
}

/** `"person"` lists one person's own bookings and is keyed on that
 * person, so someone with no login can still be handed a URL;
 * `"company"` lists every project/period and is keyed on the user who
 * issued it, gated on module access and never issued to a scope:own
 * role. */
export type CalendarFeedKind = "person" | "company";

export interface CalendarFeed {
  id: number;
  userId: number | null;
  personId: number | null;
  kind: CalendarFeedKind;
  token: string;
  createdAt: string;
}

/** An unlinked user whose e-mail matches exactly one unlinked person.
 * Only ever a suggestion — applying it is an explicit admin action. */
export interface PersonLinkSuggestion {
  userId: number;
  userName: string;
  userEmail: string;
  personId: number;
  personName: string;
}

export interface ProjectMaterialPrice {
  id: number;
  projectId: number;
  materialId: number;
  dayPrice: number | null;
  material: Material;
}

export interface ProjectPersonPrice {
  id: number;
  projectId: number;
  personId: number;
  dayPrice: number | null;
  person: Person;
}

/** Another project that holds units of a material in an open line's period.
 * `projectId`/`name` are absent for a scope-own caller. */
export interface StockHolder {
  projectId?: number;
  name?: string;
  status: string;
  units: number;
}

/** GET /api/projects/:id/stock-hints — one entry per shortage row. */
export type StockHint =
  | { shortageId: number; kind: "open"; freeNow: number; holders: StockHolder[]; more: number }
  | { shortageId: number; kind: "hired"; ownFreeNow: number };

/** Returned by PUT /api/projects/:id when the project was just cancelled. */
export interface ProjectReleaseSummary {
  released: number;
  keptShipped: { material: string; quantity: number; period: string }[];
  hired: { supplier: string; material: string; quantity: number; period: string }[];
}

export interface Project {
  id: number;
  name: string;
  client: string | null;
  clientId: number | null;
  clientRel?: Client | null;
  location: string | null;
  locationId: number | null;
  locationRel?: Location | null;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  notes: string | null;
  createdAt: string;
  periods: Period[];
  materialPrices: ProjectMaterialPrice[];
  personPrices: ProjectPersonPrice[];
}

export interface MaterialAvailability {
  material: Material & {
    basePrice: number | null;
    hasOverride: boolean;
    isBundle?: boolean;
  };
  totalStock: number;
  availableCount: number;
  availableStockItemIds: number[];
  sharedComponents?: string[];
}

export interface NoteImage {
  id: number;
  noteId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** One person a note is for, and whether they have ticked it off. */
export interface NoteAssignee {
  personId: number;
  personName: string;
  doneAt: string | null;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  noteDate: string;
  projectId: number | null;
  clientId: number | null;
  createdById: number | null;
  createdByName: string;
  updatedById: number | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: number; name: string } | null;
  client?: { id: number; name: string } | null;
  images: NoteImage[];
  assignees: NoteAssignee[];
}

export interface PersonAvailability {
  person: Person & { basePrice: number | null; hasOverride: boolean };
  isAvailable: boolean;
  /** H2.1 — the API also names the conflicting *window* (ISO strings), not
   * just the project, so the booking dialog can warn with dates before
   * the user confirms a double booking. */
  blockingProject?: { id: number; name: string; from: string; to: string };
  sameProjectWarning?: { projectId: number; projectName: string };
}

export interface ApiError {
  error: string;
}

export interface BookingResponse<T> {
  assignment: T;
  warnings: string[];
}

// DDL-3 — hand-maintained mirror of the Invoice/InvoiceLine/Payment
// models (.plans/invoice-design.md §1.3). Never generated; extend here
// whenever the Prisma schema's invoice models change.
export type InvoiceKind = "invoice" | "creditnota" | "offerte";
// Persisted. `aanvaard`/`geweigerd` only occur on a quote (kind "offerte");
// `betaald` only on an invoice.
export type InvoiceStatus = "concept" | "verzonden" | "betaald" | "aanvaard" | "geweigerd";
export type InvoiceRole = "deposit" | "final" | "standalone";
export type InvoiceLineKind =
  | "person"
  | "material"
  | "bundle"
  | "travel"
  | "deduction"
  | "deposit"
  | "manual"
  // Free-text paragraph (extra agreements, conditions): no quantity, price
  // or VAT — contributes nothing to any total.
  | "text";
export type InvoiceLineUnit = "dag" | "uur" | "stuk";
export type DepositType = "fixed" | "percentage";

// Derived-only (src/lib/invoice-status.ts), never sent as `status` on
// the wire — see the design doc §6.
export type InvoiceDisplayStatus =
  | "concept"
  | "verzonden"
  | "gedeeltelijk_betaald"
  | "betaald"
  | "vervallen"
  | "creditnota"
  // quotes
  | "aanvaard"
  | "geweigerd"
  | "verlopen";

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  section: string | null;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate: number;
  lineTotalExcl: number;
  sortOrder: number;
  sourceKind: string | null;
  sourceId: number | null;
}

export interface Payment {
  id: number;
  invoiceId: number;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Invoice {
  id: number;
  kind: InvoiceKind;
  series: "invoice" | "credit" | "quote";
  status: InvoiceStatus;
  invoiceRole: InvoiceRole;
  number: string | null;
  year: number | null;
  projectId: number | null;
  clientId: number;
  creditNoteOfId: number | null;
  /** On a credit note: number and date of the invoice it corrects. */
  creditNoteOfNumber?: string | null;
  /** On a replacement: number of the invoice it replaces. */
  correctionOfId?: number | null;
  correctionOfNumber?: string | null;
  /** On a corrected invoice: its replacement. */
  correctedBy?: { id: number; number: string | null; status: InvoiceStatus } | null;
  /** On a credit note created by a correction: the replacement sent with it. */
  correctionReplacement?: { id: number; number: string | null; status: InvoiceStatus } | null;
  creditNoteOfDate?: string | null;
  clientName: string;
  clientAddress: string | null;
  clientPostalCode: string | null;
  clientCity: string | null;
  clientVatNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paymentReference: string | null;
  currency: string;
  subtotalExcl: number;
  travelExcl: number;
  deductionExcl: number;
  vatAmount: number;
  totalIncl: number;
  depositType: DepositType | null;
  depositPercentage: number | null;
  depositBasisExcl: number | null;
  notes: string | null;
  footer: string | null;
  /** Concept only: payment term (days) for this invoice, overriding the setting. */
  paymentTermDays: number | null;
  /** Quotes: last day the quote can be accepted (set when it is sent). */
  validUntil: string | null;
  acceptedAt: string | null;
  /** On an invoice made from a quote: which one. */
  sourceQuoteId: number | null;
  sourceQuoteNumber?: string | null;
  /** The project the document is about ("Betreft"). */
  projectName?: string | null;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  projectLocation?: string | null;
  createdAt: string;
  finalizedAt: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
  creditNotes?: Invoice[];
  // computed, added by the API, never persisted (design doc §6):
  displayStatus: InvoiceDisplayStatus;
  remainingBalance: number;
  /** Only on the detail GET of a concept: the project changed since the
   * lines were generated. */
  isStale?: boolean;
}
