import { describe, it, expect } from "vitest";
import { scopeFunctionsToClientRates } from "./scope-functions-to-client";

const electrician = { personId: 1, functionId: 1, dayRate: null, hourRate: null };
const carpenter = { personId: 1, functionId: 2, dayRate: null, hourRate: null };

describe("scopeFunctionsToClientRates (L3.2)", () => {
  it("a client with zero rate-card rows offers every one of the person's functions — the critical fallback", () => {
    const result = scopeFunctionsToClientRates([electrician, carpenter], []);
    expect(result).toEqual([electrician, carpenter]);
  });

  it("a client with rate-card rows restricts the choice to only those functions", () => {
    const clientRates = [
      { id: 1, clientId: 1, functionId: 1, dayRate: 300, hourRate: null },
    ];
    const result = scopeFunctionsToClientRates([electrician, carpenter], clientRates);
    expect(result).toEqual([electrician]);
  });

  it("a rate-card row for a function the person doesn't have is simply not offered", () => {
    const clientRates = [
      { id: 1, clientId: 1, functionId: 99, dayRate: 300, hourRate: null },
    ];
    const result = scopeFunctionsToClientRates([electrician, carpenter], clientRates);
    expect(result).toEqual([]);
  });
});
