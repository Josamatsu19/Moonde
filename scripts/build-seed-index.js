import fs from "node:fs/promises";
import path from "node:path";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const USER_AGENT =
  "MoonDex-Portfolio-Builder/1.0 (Educational Non-Commercial; VanillaJS)";
const LIMIT = Number(process.env.SEED_LIMIT || 25);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function buildSeed() {
  console.log(
    `[MoonDex Seed] Descargando lote inicial (${LIMIT} especies) con uso justo...`,
  );
  const list = await fetchJson(
    `${POKEAPI_BASE}/pokemon?limit=${LIMIT}&offset=0`,
  );
  const entries = [];

  for (const item of list.results) {
    const pokemon = await fetchJson(item.url);
    await sleep(65);
    const species = await fetchJson(pokemon.species.url);
    await sleep(65);

    const esName =
      species.names.find((n) => n.language.name === "es")?.name || pokemon.name;
    const enName =
      species.names.find((n) => n.language.name === "en")?.name || pokemon.name;

    const statMap = Object.fromEntries(
      pokemon.stats.map((s) => [s.stat.name, s.base_stat]),
    );
    const bst = Object.values(statMap).reduce((acc, v) => acc + v, 0);
    const genNumber =
      Number(species.generation.url.split("/").filter(Boolean).pop()) || 1;

    entries.push({
      id: pokemon.id,
      slug: pokemon.name,
      names: { es: esName, en: enName },
      types: pokemon.types.map((t) => t.type.name),
      baseStats: {
        hp: statMap.hp,
        atk: statMap.attack,
        def: statMap.defense,
        spa: statMap["special-attack"],
        spd: statMap["special-defense"],
        spe: statMap.speed,
        bst,
      },
      generationId: genNumber,
      color: species.color?.name || "unknown",
      shape: species.shape?.name || "unknown",
      habitat: species.habitat?.name || null,
      isLegendary: Boolean(species.is_legendary),
      isMythical: Boolean(species.is_mythical),
    });
  }

  const outPath = path.resolve("public/data/seed-index.min.json");
  await fs.writeFile(
    outPath,
    JSON.stringify(
      { schemaVersion: 1, generatedAt: new Date().toISOString(), entries },
      null,
      2,
    ),
  );
  console.log(
    `[MoonDex Seed] Semilla escrita con éxito en ${outPath} (${entries.length} registros).`,
  );
}

buildSeed().catch((err) => {
  console.error("[MoonDex Seed] Error:", err);
  process.exit(1);
});
