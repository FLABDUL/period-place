import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  const projectDirectory = process.cwd();
  loadEnvConfig(projectDirectory);

  const [command, ...flags] = process.argv.slice(2);
  const useLocalDatabase = flags.includes("--local");
  const allowHostedDatabase = flags.includes("--hosted");

  if (useLocalDatabase && allowHostedDatabase) {
    throw new Error("Choose either --local or --hosted, not both.");
  }

  if (useLocalDatabase) {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    process.env.PERIOD_PLACE_DB_PATH ||= path.join(projectDirectory, ".data", "period-place.db");
  }

  if (process.env.TURSO_DATABASE_URL && !allowHostedDatabase) {
    throw new Error("A hosted database is configured. Re-run with --hosted after checking the target environment, or use --local.");
  }

  const database = await import("../src/lib/db");
  await database.initialisePeriodPlaceDatabase();

  if (command === "migrate") {
    const summary = await database.getDatabaseSummary();
    console.log(`Database ready: ${summary.publishedLocations} published locations, ${summary.pendingSubmissions} pending reports.`);
  } else if (command === "check") {
    console.log(JSON.stringify(await database.getDatabaseSummary(), null, 2));
  } else if (command === "export") {
    const outputIndex = flags.indexOf("--output");
    const requested = outputIndex >= 0 ? flags[outputIndex + 1] : undefined;
    const outputPath = path.resolve(requested || path.join(projectDirectory, ".data", "backups", `period-place-${new Date().toISOString().replaceAll(":", "-")}.json`));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(await database.exportDatabaseSnapshot(), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(`Database export written to ${outputPath}`);
  } else if (command === "restore") {
    const inputIndex = flags.indexOf("--input");
    const input = inputIndex >= 0 ? flags[inputIndex + 1] : undefined;
    if (!input || !flags.includes("--replace")) throw new Error("Restore requires --input <backup.json> and the explicit --replace confirmation flag.");
    const inputPath = path.resolve(input);
    await database.restoreDatabaseSnapshot(JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown);
    console.log(`Database restored from ${inputPath}.`);
  } else {
    throw new Error("Use one of: migrate, check, export, restore.");
  }

  await database.closeDatabaseConnection();
}

void main();
