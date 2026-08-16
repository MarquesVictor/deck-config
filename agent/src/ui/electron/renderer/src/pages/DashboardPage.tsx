import { useEffect, useState } from "react";
import type { App } from "@stream-deck/shared";
import type { ConnectedClientInfo, MachineInfo } from "../../../ipc";

const POLL_INTERVAL_MS = 3000;

interface Props {
  onOpenApps: () => void;
  onOpenSettings: () => void;
}

export function DashboardPage({ onOpenApps, onOpenSettings }: Props) {
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [clients, setClients] = useState<ConnectedClientInfo[]>([]);

  useEffect(() => {
    window.streamDeck.getMachineInfo().then(setMachine);
    window.streamDeck.listApps().then(setApps);

    const refreshClients = () => window.streamDeck.getConnectedClients().then(setClients);
    refreshClients();
    const interval = setInterval(refreshClients, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Status do Agent e dos celulares conectados.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="status-pill">
            <span className="dot" />
            Online
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Computador</div>
          <div className="stat-value" style={{ fontSize: 15 }}>
            {machine?.name ?? "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Celulares conectados</div>
          <div className="stat-value">{clients.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aplicativos configurados</div>
          <div className="stat-value">{apps.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 10 }}>
          Conexão manual (para o celular)
        </div>
        {machine ? (
          machine.ipAddresses.length > 0 ? (
            <div className="app-list">
              {machine.ipAddresses.map((ip) => (
                <span key={ip} className="connect-hint">
                  {ip}:{machine.port}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-dim">
              Nenhum endereço de rede local detectado. Verifique sua conexão Wi-Fi.
            </span>
          )
        ) : (
          <span className="text-dim">Carregando...</span>
        )}
        <p style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
          No app do celular, insira o IP deste computador na rede local e a porta acima.
        </p>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 10 }}>
          Celulares conectados
        </div>
        {clients.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: 13, margin: 0 }}>
            Nenhum celular conectado no momento.
          </p>
        ) : (
          <div className="app-list">
            {clients.map((client) => (
              <div key={client.clientId} className="app-row">
                <span className="app-row-icon">📱</span>
                <div className="app-row-body">
                  <div className="app-row-name">{client.clientId.slice(0, 8)}</div>
                  <div className="app-row-path">
                    {client.authenticated ? "autenticado" : "aguardando handshake"} · conectado há{" "}
                    {formatElapsed(client.connectedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 20 }}>
        <button className="btn" onClick={onOpenApps}>
          Ver aplicativos
        </button>
        <button className="btn" onClick={onOpenSettings}>
          Configurações
        </button>
      </div>
    </>
  );
}

function formatElapsed(since: number): string {
  const seconds = Math.floor((Date.now() - since) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h`;
}
