// M1 — fixed from a hard-coded 2-digit-prefix + literal "01" segment to
// a plain 4-digit prefix match. The real equipment export's folders
// carry 4-digit prefixes (`0501-Tenten`, `9998-...`); the old pattern
// truncated anything past 2 digits, so `9997`/`9998`/`9999` all
// collapsed onto the same "99" bucket and collided. Must land before
// any import writes a category-derived code.
export function nextCode(prefix: string, existingCodes: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d{3})$`);
  const used = new Set<number>();
  for (const code of existingCodes) {
    const match = code.match(pattern);
    if (match) used.add(parseInt(match[1], 10));
  }
  for (let seq = 1; seq <= 999; seq++) {
    if (!used.has(seq)) {
      return `${prefix}-${String(seq).padStart(3, "0")}`;
    }
  }
  throw new Error("Geen vrije code meer in deze categorie");
}
