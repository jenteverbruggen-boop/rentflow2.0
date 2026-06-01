import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type ImportedMaterial = {
  code: string;
  name: string;
  category: string | null;
  notes: string | null;
  dayPrice: number;
  stockItems: { identifier: string | null; notes: string | null }[];
};

type CsvRecord = Record<string, string>;

const MATERIALS_CSV_PATH = process.env.MATERIALS_CSV_PATH
  ? path.resolve(process.cwd(), process.env.MATERIALS_CSV_PATH)
  : path.join(process.cwd(), "prisma/seed-data/materials.csv");

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function parseCsv(content: string): CsvRecord[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: CsvRecord = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function categoryFromCode(code: string): string | null {
  const prefix = code.slice(0, 2);
  const categoryByPrefix: Record<string, string> = {
    "01": "Audio",
    "02": "Catering",
    "03": "Verlichting",
    "04": "Meubilair",
    "05": "Tenten",
    "06": "Video",
    "07": "Steiger",
    "11": "Communicatie",
    "89": "Verwarming",
    "99": "Servies",
  };
  return categoryByPrefix[prefix] ?? null;
}

function composeCategory(code: string, materialType: string): string | null {
  const category = categoryFromCode(code);
  const type = materialType.trim();
  if (category && type) return `${category} - ${type}`;
  return category ?? (type || null);
}

function parseNumber(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/\s/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function rowDayPrice(row: CsvRecord): number | null {
  const candidates = [
    "Dagprijs",
    "Dag prijs",
    "Huurprijs",
    "Huurprijs per dag",
    "Verhuurprijs",
    "Prijs",
    "Prijs per dag",
    "Huidige boekwaarde (Exemplaar)",
  ];

  for (const key of candidates) {
    const parsed = parseNumber(row[key] ?? "");
    if (parsed != null) return parsed;
  }

  return null;
}

function fallbackMaterials(): ImportedMaterial[] {
  return [
    {
      code: "0501-001",
      name: "Tent 4x8",
      category: "Tenten - Fysiek item",
      notes: "Fallback seed item | Code: 0501-001",
      dayPrice: 95,
      stockItems: [
        { identifier: "Tent-4x8-1", notes: null },
        { identifier: "Tent-4x8-2", notes: null },
      ],
    },
    {
      code: "0501-003",
      name: "Tent 5x10",
      category: "Tenten - Fysiek item",
      notes: "Fallback seed item | Code: 0501-003",
      dayPrice: 120,
      stockItems: [
        { identifier: "Tent-5x10-1", notes: null },
        { identifier: "Tent-5x10-2", notes: null },
      ],
    },
    {
      code: "0301-001",
      name: "Guirlande (10m)",
      category: "Verlichting - Fysiek item",
      notes: "Fallback seed item | Code: 0301-001",
      dayPrice: 12,
      stockItems: [{ identifier: "Guirlande-10m-1", notes: null }],
    },
    {
      code: "0201-010",
      name: "Horeca Frigo",
      category: "Catering - Fysiek item",
      notes: "Fallback seed item | Code: 0201-010",
      dayPrice: 45,
      stockItems: [{ identifier: "Frigo-1", notes: null }],
    },
    {
      code: "0201-004",
      name: "Cava glazen",
      category: "Catering - Fysiek item",
      notes: "Fallback seed item | Code: 0201-004",
      dayPrice: 8,
      stockItems: [{ identifier: "Cava-1", notes: null }],
    },
  ];
}

function importMaterialsFromCsv(): ImportedMaterial[] {
  if (!existsSync(MATERIALS_CSV_PATH)) {
    console.warn(`Seed CSV not found at ${MATERIALS_CSV_PATH}; using fallback material list.`);
    return fallbackMaterials();
  }

  const csvContent = readFileSync(MATERIALS_CSV_PATH, "utf8");
  const rows = parseCsv(csvContent);
  if (rows.length === 0) {
    console.warn(`Seed CSV is empty at ${MATERIALS_CSV_PATH}; using fallback material list.`);
    return fallbackMaterials();
  }

  const map = new Map<string, ImportedMaterial>();
  for (const row of rows) {
    const code = (row["Code"] ?? "").trim();
    const name = (row["Naam (in database)"] ?? "").trim();
    if (!code || !name) continue;

    const type = (row["Type materiaal"] ?? "").trim();
    const key = `${code}::${name}`;

    if (!map.has(key)) {
      const notesParts = [`Code: ${code}`];
      if (type) notesParts.push(`Type: ${type}`);
      map.set(key, {
        code,
        name,
        category: composeCategory(code, type),
        notes: notesParts.join(" | "),
        dayPrice: 0,
        stockItems: [],
      });
    }

    const item = map.get(key)!;
    const importedPrice = rowDayPrice(row);
    if (importedPrice != null && importedPrice > 0) {
      item.dayPrice = item.dayPrice > 0 ? Math.min(item.dayPrice, importedPrice) : importedPrice;
    }

    const itemId = (row["ID (Exemplaar)"] ?? "").trim();
    const displayName = (row["Weergavenaam (Exemplaar)"] ?? "").trim();
    const serial = (row["Fabrikant serienummer (Exemplaar)"] ?? "").trim();
    const internalRef = (row["Interne referentie (Exemplaar)"] ?? "").trim();
    const activeRaw = (row["Actief (Exemplaar)"] ?? "").trim();
    const remark = (row["Opmerking (Exemplaar)"] ?? "").trim();

    const identifier = [serial, displayName, internalRef].find((value) => value.length > 0) ?? null;
    const noteParts: string[] = [];
    if (itemId) noteParts.push(`Exemplaar ID: ${itemId}`);
    if (activeRaw === "0") noteParts.push("Inactive in source");
    if (remark) noteParts.push(remark);

    // Every CSV row represents one unit; exemplar metadata is optional.
    item.stockItems.push({
      identifier,
      notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
    });
  }

  const parsed = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (parsed.length === 0) {
    console.warn(`No valid material rows parsed from ${MATERIALS_CSV_PATH}; using fallback material list.`);
    return fallbackMaterials();
  }

  return parsed;
}

async function main() {
  await prisma.periodStockItem.deleteMany();
  await prisma.periodPerson.deleteMany();
  await prisma.period.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.person.deleteMany();
  await prisma.material.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { email: "admin@rentflow.dev", password: await bcrypt.hash("admin123", 10), name: "Admin", role: "admin" },
      { email: "jan@rentflow.dev", password: await bcrypt.hash("user123", 10), name: "Jan Peeters", role: "user" },
    ],
  });

  const [alice, bob, charlie, diana, eric, fiona] = await prisma.$transaction([
    prisma.person.create({ data: { name: "Alice Vermeersch", role: "Project Manager", email: "alice@example.com", phone: "0471 12 34 56", dayPrice: 450 } }),
    prisma.person.create({ data: { name: "Bob Claes", role: "Electrician", email: "bob@example.com", phone: "0472 23 45 67", dayPrice: 320 } }),
    prisma.person.create({ data: { name: "Charlie De Smedt", role: "Carpenter", email: "charlie@example.com", phone: "0473 34 56 78", dayPrice: 300 } }),
    prisma.person.create({ data: { name: "Diana Leclercq", role: "Plumber", email: "diana@example.com", phone: "0474 45 67 89", dayPrice: 310 } }),
    prisma.person.create({ data: { name: "Eric Wouters", role: "Crane Operator", email: "eric@example.com", phone: "0475 56 78 90", dayPrice: 380 } }),
    prisma.person.create({ data: { name: "Fiona Janssen", role: "Safety Officer", email: "fiona@example.com", phone: "0476 67 89 01", dayPrice: 360 } }),
  ]);

  const materialDefs = importMaterialsFromCsv();
  const pricedMaterialCount = materialDefs.filter((m) => m.dayPrice > 0).length;

  const materials: Record<string, { id: number; dayPrice: number; stockItemIds: number[] }> = {};
  for (const def of materialDefs) {
    const material = await prisma.material.create({
      data: { name: def.name, category: def.category, dayPrice: def.dayPrice, notes: def.notes },
    });
    const stockItemIds: number[] = [];
    for (let n = 0; n < def.stockItems.length; n++) {
      const stock = def.stockItems[n];
      const item = await prisma.stockItem.create({
        data: {
          materialId: material.id,
          unitNumber: n + 1,
          identifier: stock.identifier,
          notes: stock.notes,
        },
      });
      stockItemIds.push(item.id);
    }
    materials[def.name] = { id: material.id, dayPrice: def.dayPrice, stockItemIds };
  }

  const festivalMain = await prisma.project.create({
    data: {
      name: "Summer Sounds Festival 2026",
      client: "Summer Sounds vzw",
      location: "Gent",
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-07-31"),
      status: "actief",
      notes: "Outdoor festival site met main stage, bars en backstage.",
      periods: {
        create: [
          { name: "Opbouw", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-14") },
          { name: "Festivaldagen", startDate: new Date("2026-05-15"), endDate: new Date("2026-07-15") },
          { name: "Afbouw", startDate: new Date("2026-07-16"), endDate: new Date("2026-07-31") },
        ],
      },
    },
    include: { periods: true },
  });
  const beachFest = await prisma.project.create({
    data: {
      name: "Sunset Beach Fest",
      client: "Coastline Events",
      location: "Oostende",
      startDate: new Date("2026-06-15"),
      endDate: new Date("2026-11-30"),
      status: "concept",
      notes: "Conceptfase voor beach stage en VIP-zone.",
      periods: {
        create: [{ name: "Voorproductie", startDate: new Date("2026-06-15"), endDate: new Date("2026-11-30") }],
      },
    },
    include: { periods: true },
  });
  const cityLights = await prisma.project.create({
    data: {
      name: "City Lights Weekender",
      client: "Stad Brugge",
      location: "Brugge",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-20"),
      status: "afgerond",
      notes: "Afgerond weekendfestival op stadsplein.",
      periods: {
        create: [{ name: "Festivalweekend", startDate: new Date("2026-04-01"), endDate: new Date("2026-05-20") }],
      },
    },
    include: { periods: true },
  });
  const technoNight = await prisma.project.create({
    data: {
      name: "Techno Night Hangar",
      client: "Warehouse Sessions",
      location: "Mechelen",
      startDate: new Date("2026-05-20"),
      endDate: new Date("2026-06-10"),
      status: "actief",
      notes: "Indoor dance event met lichtshow en catering setup.",
      periods: {
        create: [{ name: "Eventproductie", startDate: new Date("2026-05-20"), endDate: new Date("2026-06-10") }],
      },
    },
    include: { periods: true },
  });

  function bookPersons(periodId: number, persons: { p: { id: number; dayPrice: number }; role?: string }[]) {
    return prisma.periodPerson.createMany({
      data: persons.map(({ p, role }) => ({
        periodId,
        personId: p.id,
        role,
        dayPriceSnapshot: p.dayPrice,
      })),
    });
  }
  function pickMaterialName(candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (materials[candidate]) return candidate;
    }
    return null;
  }

  function bookMaterial(periodId: number, materialCandidates: string[], qty: number) {
    const materialName = pickMaterialName(materialCandidates);
    if (!materialName) return Promise.resolve();
    const m = materials[materialName];
    const ids = m.stockItemIds.slice(0, qty);
    if (ids.length === 0) return Promise.resolve();
    return prisma.periodStockItem.createMany({
      data: ids.map((stockItemId) => ({
        periodId,
        stockItemId,
        dayPriceSnapshot: m.dayPrice,
      })),
    });
  }

  const festDays = festivalMain.periods.find((p) => p.name === "Festivaldagen")!;
  const festBuild = festivalMain.periods.find((p) => p.name === "Opbouw")!;
  await bookPersons(festDays.id, [
    { p: { id: alice.id, dayPrice: 450 }, role: "Project Manager" },
    { p: { id: bob.id, dayPrice: 320 }, role: "Electrician" },
    { p: { id: charlie.id, dayPrice: 300 }, role: "Carpenter" },
    { p: { id: fiona.id, dayPrice: 360 }, role: "Safety Officer" },
  ]);
  await bookMaterial(festBuild.id, ["Tent 4x8", "Tent 5x10", "Tent 8x16"], 2);
  await bookMaterial(festDays.id, ["Tent 5x10", "Tent 4x8", "Tent 8x20"], 1);
  await bookMaterial(festDays.id, ["Horeca Frigo"], 2);
  await bookMaterial(festDays.id, ["Tap instalatie", "Tap met spoelbak"], 1);
  await bookMaterial(festDays.id, ["Guirlande (10m)", "Guirlande (15m)", "Guirlande (25m)"], 2);

  const technoP = technoNight.periods[0];
  await bookPersons(technoP.id, [
    { p: { id: eric.id, dayPrice: 380 }, role: "Crane Operator" },
  ]);
  await bookMaterial(technoP.id, ["Tent 5x6 (6 hoek)", "Tent 5x10"], 1);
  await bookMaterial(technoP.id, ["Guirlande (11,5m)", "Guirlande (12,5m)", "Ledpar"], 1);

  const cityP = cityLights.periods[0];
  await bookPersons(cityP.id, [
    { p: { id: diana.id, dayPrice: 310 }, role: "Plumber" },
  ]);
  await bookMaterial(cityP.id, ["Cava glazen", "Witte wijnglazen", "Rode wijnglazen"], 1);
  await bookMaterial(cityP.id, ["Borden 32 (wit)", "Borden 24 (wit)"], 1);

  const beachP = beachFest.periods[0];
  await bookPersons(beachP.id, [
    { p: { id: charlie.id, dayPrice: 300 }, role: "Carpenter" },
  ]);
  await bookMaterial(beachP.id, ["Tent 4x8", "Tent 5x10", "Tent 10x40"], 1);
  await bookMaterial(beachP.id, ["Horeca Frigo"], 1);
  await bookMaterial(beachP.id, ["Tap instalatie", "Tap met spoelbak"], 1);

  console.log("Seed complete.");
  console.log(`  Materials with non-zero day price: ${pricedMaterialCount}/${materialDefs.length}`);
  console.log("  Login: admin@rentflow.dev / admin123");
  console.log("  Login: jan@rentflow.dev  / user123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
