import { Bonjour, type Service } from "bonjour-service";
import type { Logger } from "../../platform/logger";

const SERVICE_TYPE = "streamdeck";
const PROTOCOL_VERSION = "1";
const AGENT_VERSION = "1.0.0";

export interface MdnsAdvertisement {
  stop: () => Promise<void>;
}

export function advertiseAgent(
  machineId: string,
  machineName: string,
  port: number,
  logger: Logger,
): MdnsAdvertisement {
  const bonjour = new Bonjour();

  const service: Service = bonjour.publish({
    name: machineName,
    type: SERVICE_TYPE,
    port,
    txt: {
      version: AGENT_VERSION,
      machineId,
      protocolVersion: PROTOCOL_VERSION,
    },
  });

  service.start();
  logger.info(`mDNS registered: _${SERVICE_TYPE}._tcp`);

  return {
    stop: () =>
      new Promise((resolve) => {
        service.stop(() => {
          bonjour.destroy();
          resolve();
        });
      }),
  };
}
