import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createEnvReport } from "../src/lib/config/env";

function parseEnvFile(path: string) {
  if (!existsSync(path)) return {};

  const env: Record<string, string> = {};
  const text = readFileSync(path, "utf-8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key) env[key] = value;
  }

  return env;
}

const envFromFile = parseEnvFile(resolve(process.cwd(), ".env"));
const report = createEnvReport({ ...envFromFile, ...process.env });

console.log("Validación de entorno Grade Law Study");
console.log("---------------------------------------");

for (const variable of report.variables) {
  const icon = variable.configured ? "OK" : variable.required ? "FALTA" : "OPCIONAL";
  console.log(`${icon.padEnd(8)} ${variable.name.padEnd(36)} ${variable.purpose}`);
}

if (!report.ok) {
  console.error("\nFaltan variables requeridas:");
  for (const name of report.missingRequired) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log("\nEntorno mínimo completo.");
