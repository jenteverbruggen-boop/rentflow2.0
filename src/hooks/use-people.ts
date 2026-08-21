import { useQuery } from "@tanstack/react-query";
import type { Person } from "@/types";

async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<Person[]>;
}

/** Read-only — the users screen only needs the roster to link a Person
 * to a User; creating/editing a Person happens on the Personen page. */
export function usePeople() {
  return useQuery({ queryKey: ["people"], queryFn: fetchPeople });
}
