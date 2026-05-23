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
}

export interface Person {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export interface Material {
  id: number;
  name: string;
  category: string | null;
  totalStock: number;
  notes: string | null;
}

export interface ProjectPerson {
  id: number;
  projectId: number;
  personId: number;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  person: Person;
}

export interface ProjectMaterial {
  id: number;
  projectId: number;
  materialId: number;
  quantity: number;
  startDate: string | null;
  endDate: string | null;
  material: Material;
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
  people: ProjectPerson[];
  materials: ProjectMaterial[];
}

export interface ApiError {
  error: string;
}
