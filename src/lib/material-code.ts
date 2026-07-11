export function nextCode(prefix: string, existingCodes: string[]): string {
  const pattern = new RegExp(`^${prefix}01-(\\d{3})$`);
  const used = new Set<number>();
  for (const code of existingCodes) {
    const match = code.match(pattern);
    if (match) used.add(parseInt(match[1], 10));
  }
  for (let seq = 1; seq <= 999; seq++) {
    if (!used.has(seq)) {
      return `${prefix}01-${String(seq).padStart(3, "0")}`;
    }
  }
  throw new Error("Geen vrije code meer in deze categorie");
}
