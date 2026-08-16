import { bootstrapAgent } from "./core/bootstrap";

async function main(): Promise<void> {
  const agent = await bootstrapAgent();

  process.on("SIGINT", () => agent.shutdown().then(() => process.exit(0)));
  process.on("SIGTERM", () => agent.shutdown().then(() => process.exit(0)));
}

main().catch((err) => {
  console.error("[FATAL] Agent failed to start", err);
  process.exit(1);
});
