export type ProjectStatus =
  | "concept"
  | "bevestigd"
  | "actief"
  | "afgerond"
  | "geannuleerd";

export type Role = "ADMIN" | "PLANNER" | "VIEWER";

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  personId: number | null;
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
  _count?: { projects: number };
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
  role: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  dayPrice: number;
  functions?: Function[];
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
  dayPriceSnapshot: number;
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
  dayPrice: number;
  isBundle: boolean;
  bundlePriceOverride: number | null;
  components?: MaterialComponent[];
  stockItems?: StockItem[];
  totalStock?: number;
  bundleStock?: BundleStock;
  setPrice?: number;
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
  material?: Material;
  assignments?: StockItemAssignment[];
}

export interface StockItemAssignment {
  id: number;
  periodId: number;
  dayPriceSnapshot: number;
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
  dayPriceSnapshot: number;
  discountPct: number | null;
  discountAmount: number | null;
  bundleBookingId: number | null;
  stockItem: StockItem & { material: Material };
}

export interface PeriodPerson {
  id: number;
  periodId: number;
  personId: number;
  role: string | null;
  dayPriceSnapshot: number;
  discountPct: number | null;
  discountAmount: number | null;
  person: Person;
}

export interface Period {
  id: number;
  projectId: number;
  name: string;
  startDate: string;
  endDate: string;
  materials: PeriodStockItem[];
  people: PeriodPerson[];
  bundleBookings?: PeriodBundleBooking[];
}

export interface ProjectMaterialPrice {
  id: number;
  projectId: number;
  materialId: number;
  dayPrice: number;
  material: Material;
}

export interface ProjectPersonPrice {
  id: number;
  projectId: number;
  personId: number;
  dayPrice: number;
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
    basePrice: number;
    hasOverride: boolean;
    isBundle?: boolean;
  };
  totalStock: number;
  availableCount: number;
  availableStockItemIds: number[];
}

export interface PersonAvailability {
  person: Person & { basePrice: number; hasOverride: boolean };
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
