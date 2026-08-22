/**
 * Temporary CLI to seed apps into config.json until the Electron UI exists.
 * Usage:
 *   npx tsx src/cli/addApp.ts --name "TextEdit" --path "/path/to/executable" --icon document
 */
import { randomUUID } from "node:crypto";
import { JsonConfigStore } from "../core/persistence/jsonConfigStore";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value) args[key] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name || !args.path) {
    console.error(
      'Usage: addApp.ts --name "TextEdit" --path "/path/to/executable" [--icon document]',
    );
    process.exit(1);
  }

  const store = new JsonConfigStore();
  const config = await store.loadConfig();
  const now = new Date().toISOString();

  await store.saveApp({
    id: `app_${randomUUID().split("-")[0]}`,
    name: args.name,
    icon: args.icon ?? "box",
    type: "application",
    action: { type: "open_app", path: args.path },
    position: config.apps.length,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Added "${args.name}" -> ${args.path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
