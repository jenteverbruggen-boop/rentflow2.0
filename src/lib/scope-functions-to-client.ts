import type { ClientFunctionRate, PersonFunction } from "@/types";

/**
 * L3.2 — scope a person's own functions to the ones their booking's
 * client has negotiated a rate for. The critical fallback (flagged by
 * the brief as the path most likely to go untested, since it's the
 * *default* state of every client until the PO fills in a rate card):
 * a client with zero rate-card rows must return every one of the
 * person's functions, never none — otherwise creating a new client
 * silently breaks booking entirely.
 */
export function scopeFunctionsToClientRates(
  personFunctions: PersonFunction[],
  clientRates: ClientFunctionRate[],
): PersonFunction[] {
  if (clientRates.length === 0) return personFunctions;
  return personFunctions.filter((f) =>
    clientRates.some((r) => r.functionId === f.functionId),
  );
}
