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
  | "instellingen";

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

export interface PeriodStockItem {
  id: number;
  periodId: number;
  stockItemId: number;
  dayPriceSnapshot: number | null;
  setupCostSnapshot: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  bundleBookingId: number | null;
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

export interface PeriodPerson {
  id: number;
  periodId: number;
  personId: number;
  functionId: number | null;
  startAt: string | null;
  endAt: string | null;
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
}

/** O1.1 — one row per (user, feed kind). `kind` is `"personal"` (the
 * caller's own bookings) or `"company"` (every project/period, gated on
 * module access and never issued to a scope:own role). */
export type CalendarFeedKind = "personal" | "company";

export interface CalendarFeed {
  id: number;
  userId: number;
  kind: CalendarFeedKind;
  token: string;
  createdAt: string;
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

export interface PersonAvailability {
  person: Person & { basePrice: number | null; hasOverride: boolean };
  isAvailable: boolean;
  blockingProject?: { id: number; name: string };
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
export type InvoiceKind = "invoice" | "creditnota";
export type InvoiceStatus = "concept" | "verzonden" | "betaald"; // persisted
export type InvoiceRole = "deposit" | "final" | "standalone";
export type InvoiceLineKind =
  | "person"
  | "material"
  | "bundle"
  | "travel"
  | "deduction"
  | "deposit"
  | "manual";
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
  | "creditnota";

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
  series: "invoice" | "credit";
  status: InvoiceStatus;
  invoiceRole: InvoiceRole;
  number: string | null;
  year: number | null;
  projectId: number | null;
  clientId: number;
  creditNoteOfId: number | null;
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
  createdAt: string;
  finalizedAt: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
  creditNotes?: Invoice[];
  // computed, added by the API, never persisted (design doc §6):
  displayStatus: InvoiceDisplayStatus;
  remainingBalance: number;
}
