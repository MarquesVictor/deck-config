import path from "node:path";
import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage } from "electron";
import { ProtocolError } from "@stream-deck/shared";
import { AGENT_VERSION, bootstrapAgent, type BootstrappedAgent } from "../../core/bootstrap";
import { AgentService } from "../../core/agentService";
import { extractMacAppIcon } from "../../platform/macIcon";
import { IPC_CHANNELS } from "./ipc";

const RENDERER_DEV_SERVER_URL = "http://localhost:5173";
const ASSETS_DIR = path.join(__dirname, "assets");

let agent: BootstrappedAgent | undefined;
let agentService: AgentService | undefined;
let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let quitting = false;

async function createWindow(startHidden: boolean): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 560,
    show: !startHidden,
    title: `Stream Deck Agent v${AGENT_VERSION}`,
    icon: path.join(ASSETS_DIR, "app-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The sandboxed preload loader has historically had rough edges with
      // a preload script that itself requires another local CJS file (our
      // ./ipc.js). This is still our own trusted local UI, not remote
      // content, so disabling the renderer sandbox is a safe trade for a
      // preload that reliably loads.
      sandbox: false,
    },
  });

  mainWindow.webContents.on("preload-error", (_e, preloadPath, error) => {
    console.error(`[preload] failed to load ${preloadPath}: ${error.message}\n${error.stack}`);
  });

  if (!app.isPackaged) {
    mainWindow.webContents.on("console-message", (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on("did-fail-load", (_e, code, description) => {
      console.error(`[renderer] failed to load: ${code} ${description}`);
    });
    await mainWindow.loadURL(RENDERER_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (quitting || !tray) return;
    // With a tray icon, closing the window hides it instead of quitting, so
    // the Agent keeps serving connected phones in the background. Without a
    // tray there'd be no way to reopen the window, so a real close is a quit.
    event.preventDefault();
    mainWindow?.hide();
  });
}

function createTray(): void {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(ASSETS_DIR, "tray-icon.png"));
  tray = new Tray(icon);
  tray.setToolTip("Stream Deck Agent");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Abrir",
        click: () => {
          mainWindow?.show();
        },
      },
      { type: "separator" },
      {
        label: "Sair",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => mainWindow?.show());
}

function destroyTray(): void {
  tray?.destroy();
  tray = undefined;
}

function registerIpcHandlers(service: AgentService): void {
  ipcMain.handle(IPC_CHANNELS.listApps, () => service.listApps());
  ipcMain.handle(IPC_CHANNELS.addApp, (_e, input) => service.addApp(input));
  ipcMain.handle(IPC_CHANNELS.updateApp, (_e, id: string, input) => service.updateApp(id, input));
  ipcMain.handle(IPC_CHANNELS.deleteApp, (_e, id: string) => service.deleteApp(id));
  ipcMain.handle(IPC_CHANNELS.reorderApps, (_e, orderedIds: string[]) => service.reorderApps(orderedIds));
  ipcMain.handle(IPC_CHANNELS.getConnectedClients, () => service.getConnectedClients());
  ipcMain.handle(IPC_CHANNELS.getSettings, () => service.getSettings());
  ipcMain.handle(IPC_CHANNELS.getMachineInfo, () => service.getMachineInfo());

  ipcMain.handle(IPC_CHANNELS.updateSettings, async (_e, patch) => {
    const settings = await service.updateSettings(patch);
    applyAutoStart(settings.autoStartWindows);
    if (settings.showInTray) createTray();
    else destroyTray();
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.testApp, async (_e, id: string) => {
    try {
      await service.testApp(id);
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof ProtocolError ? err.message : "Falha ao testar o aplicativo.";
      return { ok: false as const, message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.pickExecutable, async () => {
    if (!mainWindow) return null;
    const filters =
      process.platform === "win32" ? [{ name: "Executável", extensions: ["exe"] }] : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters,
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC_CHANNELS.getFileIcon, async (_e, targetPath: string) => {
    if (process.platform === "darwin") {
      return extractMacAppIcon(targetPath, ASSETS_DIR);
    }
    try {
      // No `size` option: it's Windows/Linux-only in Electron — macOS
      // (handled above) ignores it, and passing "large" there is what
      // caused a native crash (unsupported enum value on that platform).
      const image = await app.getFileIcon(targetPath);
      return image.isEmpty() ? null : image.toDataURL();
    } catch {
      return null;
    }
  });
}

function applyAutoStart(enabled: boolean): void {
  if (process.platform === "linux") return; // setLoginItemSettings is unsupported on Linux.
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
}

app.whenReady().then(async () => {
  // On macOS the Dock icon during `npm run electron:dev` defaults to the
  // generic Electron.app icon — it isn't derived from BrowserWindow's
  // `icon` option (that only affects window chrome). Only a packaged build
  // picks up app-icon.png as the actual bundle icon automatically.
  app.dock?.setIcon(path.join(ASSETS_DIR, "app-icon.png"));

  agent = await bootstrapAgent();
  agentService = new AgentService(
    agent.configStore,
    agent.actionRegistry,
    agent.server.connectionManager,
    {
      id: agent.machineId,
      name: agent.machineName,
      port: agent.server.port,
      ipAddresses: agent.ipAddresses,
    },
  );

  const settings = await agentService.getSettings();
  applyAutoStart(settings.autoStartWindows);

  registerIpcHandlers(agentService);
  if (settings.showInTray) createTray();
  await createWindow(settings.startMinimized && settings.showInTray);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(false);
    } else {
      mainWindow?.show();
    }
  });
});

app.on("window-all-closed", () => {
  // With a tray icon, the Agent stays alive so connected phones stay served
  // even with the dashboard window closed. Without one, there's no way to
  // reopen the window, so closing it is the same as quitting.
  if (!tray) app.quit();
});

app.on("before-quit", async (event) => {
  if (!agent) return;
  quitting = true;
  event.preventDefault();
  await agent.shutdown();
  agent = undefined;
  app.exit(0);
});
