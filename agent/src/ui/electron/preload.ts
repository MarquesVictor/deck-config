import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type StreamDeckApi } from "./ipc";

const api: StreamDeckApi = {
  listApps: () => ipcRenderer.invoke(IPC_CHANNELS.listApps),
  addApp: (input) => ipcRenderer.invoke(IPC_CHANNELS.addApp, input),
  updateApp: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.updateApp, id, input),
  deleteApp: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteApp, id),
  reorderApps: (orderedIds) => ipcRenderer.invoke(IPC_CHANNELS.reorderApps, orderedIds),
  testApp: (id) => ipcRenderer.invoke(IPC_CHANNELS.testApp, id),
  getConnectedClients: () => ipcRenderer.invoke(IPC_CHANNELS.getConnectedClients),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  getMachineInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getMachineInfo),
  pickExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.pickExecutable),
  getFileIcon: (path) => ipcRenderer.invoke(IPC_CHANNELS.getFileIcon, path),
};

contextBridge.exposeInMainWorld("streamDeck", api);
