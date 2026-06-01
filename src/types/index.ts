export type ProjectStatus =
  | "concept"
  | "bevestigd"
  | "actief"
  | "afgerond"
  | "geannuleerd";

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface Person {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  dayPrice: number;
}

export interface Material {
  id: number;
  name: string;
  category: string | null;
  notes: string | null;
  dayPrice: number;
  stockItems?: StockItem[];
  totalStock?: number;
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
  location: string | null;
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
  material: Material & { basePrice: number; hasOverride: boolean };
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
