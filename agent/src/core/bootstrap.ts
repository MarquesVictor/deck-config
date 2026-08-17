import { ActionRegistry } from "./actions";
import { createOpenAppHandler } from "./actions/openApp";
import { registerMediaControlActions } from "./actions/mediaControl";
import { JsonConfigStore } from "./persistence/jsonConfigStore";
import { RequestRouter } from "./requestRouter";
import { createLogger, type Logger } from "../platform/logger";
import { localIPv4Addresses } from "../platform/network";
import { advertiseAgent, type MdnsAdvertisement } from "../transport/mdns/advertiser";
import { startWebSocketServer, type StartedServer } from "../transport/websocket/server";

export const AGENT_VERSION = "1.0.0";

export interface BootstrappedAgent {
  logger: Logger;
  configStore: JsonConfigStore;
  actionRegistry: ActionRegistry;
  router: RequestRouter;
  server: StartedServer;
  mdns: MdnsAdvertisement;
  machineId: string;
  machineName: string;
  ipAddresses: string[];
  shutdown: () => Promise<void>;
}

/**
 * Boots every core service (config, actions, WebSocket, mDNS) shared by the
 * headless CLI entrypoint and the Electron main process. Callers own the
 * BrowserWindow / process lifecycle; this only owns the backend services.
 */
export async function bootstrapAgent(): Promise<BootstrappedAgent> {
  const logger = createLogger("info");
  logger.info("Stream Deck Agent started");

  const configStore = new JsonConfigStore();
  const config = await configStore.loadConfig();
  logger.info(`Machine: ${config.machine.name} (${config.machine.id})`);
  logger.info(`Version: ${AGENT_VERSION}`);
  logger.info(`Loaded ${config.apps.length} applications`);

  const actionRegistry = new ActionRegistry();
  actionRegistry.register("open_app", createOpenAppHandler(configStore, logger));
  registerMediaControlActions(actionRegistry);

  const router = new RequestRouter(configStore, actionRegistry);

  const server = await startWebSocketServer(
    { id: config.machine.id, name: config.machine.name, version: AGENT_VERSION },
    router,
    logger,
  );

  const mdns = advertiseAgent(config.machine.id, config.machine.name, server.port, logger);

  const ipAddresses = localIPv4Addresses();
  for (const address of ipAddresses) {
    logger.info(`Reachable at ${address}:${server.port} (for manual connection on mobile)`);
  }
  logger.info("Ready for connections");

  return {
    logger,
    configStore,
    actionRegistry,
    router,
    server,
    mdns,
    machineId: config.machine.id,
    machineName: config.machine.name,
    ipAddresses,
    shutdown: async () => {
      logger.info("Shutting down...");
      await mdns.stop();
      await server.close();
    },
  };
}
