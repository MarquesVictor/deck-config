import { networkInterfaces } from "node:os";
import { ActionRegistry } from "./core/actions";
import { createOpenAppHandler } from "./core/actions/openApp";
import { JsonConfigStore } from "./core/persistence/jsonConfigStore";
import { RequestRouter } from "./core/requestRouter";
import { createLogger } from "./platform/logger";
import { advertiseAgent } from "./transport/mdns/advertiser";
import { startWebSocketServer } from "./transport/websocket/server";

const AGENT_VERSION = "1.0.0";

async function main(): Promise<void> {
  const logger = createLogger("info");
  logger.info("Stream Deck Agent started");

  const configStore = new JsonConfigStore();
  const config = await configStore.loadConfig();
  logger.info(`Machine: ${config.machine.name} (${config.machine.id})`);
  logger.info(`Version: ${AGENT_VERSION}`);
  logger.info(`Loaded ${config.apps.length} applications`);

  const actionRegistry = new ActionRegistry();
  actionRegistry.register("open_app", createOpenAppHandler(configStore, logger));

  const router = new RequestRouter(configStore, actionRegistry);

  const server = await startWebSocketServer(
    { id: config.machine.id, name: config.machine.name, version: AGENT_VERSION },
    router,
    logger,
  );

  const mdns = advertiseAgent(config.machine.id, config.machine.name, server.port, logger);

  for (const address of localIPv4Addresses()) {
    logger.info(`Reachable at ${address}:${server.port} (for manual connection on mobile)`);
  }
  logger.info("Ready for connections");

  const shutdown = async () => {
    logger.info("Shutting down...");
    await mdns.stop();
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function localIPv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

main().catch((err) => {
  console.error("[FATAL] Agent failed to start", err);
  process.exit(1);
});
