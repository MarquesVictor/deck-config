import { useEffect, useState } from "react";
import type { AgentSettings, MachineInfo } from "../../../ipc";
import { Select } from "../components/Select";

interface Props {
  notify: (text: string, kind?: "success" | "error") => void;
}

const LOG_LEVELS: AgentSettings["logLevel"][] = ["trace", "debug", "info", "warn", "error", "fatal"];

export function SettingsPage({ notify }: Props) {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [machine, setMachine] = useState<MachineInfo | null>(null);

  useEffect(() => {
    window.streamDeck.getSettings().then(setSettings);
    window.streamDeck.getMachineInfo().then(setMachine);
  }, []);

  const update = async (patch: Partial<AgentSettings>) => {
    const next = await window.streamDeck.updateSettings(patch);
    setSettings(next);
    notify("Configurações salvas.");
  };

  if (!settings) return null;

  return (
    <>
      <div className="page-header">
        <h1>Configurações</h1>
        <p>Como o Agent se comporta neste computador.</p>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          Geral
        </div>
        <SettingRow
          label="Iniciar automaticamente com o sistema"
          desc="Abre o Agent (minimizado) ao ligar o computador."
          checked={settings.autoStartWindows}
          onChange={(v) => update({ autoStartWindows: v })}
        />
        <SettingRow
          label="Iniciar minimizado"
          desc="A janela abre escondida; use o ícone na bandeja para mostrar."
          checked={settings.startMinimized}
          onChange={(v) => update({ startMinimized: v })}
        />
        <SettingRow
          label="Mostrar no ícone da bandeja"
          desc="Fechar a janela mantém o Agent rodando em segundo plano."
          checked={settings.showInTray}
          onChange={(v) => update({ showInTray: v })}
        />
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 12 }}>
          Rede
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Porta</div>
            <div className="settings-row-desc">Definida automaticamente ao iniciar.</div>
          </div>
          <span className="connect-hint">{machine?.port ?? "—"}</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Nome do computador</div>
            <div className="settings-row-desc">Como aparece na lista de descoberta do celular.</div>
          </div>
          <span className="connect-hint">{machine?.name ?? "—"}</span>
        </div>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 12 }}>
          Logs
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Nível</div>
            <div className="settings-row-desc">Quanto mais baixo, mais detalhado.</div>
          </div>
          <Select
            value={settings.logLevel}
            options={LOG_LEVELS.map((level) => ({ value: level, label: level }))}
            onChange={(level) => update({ logLevel: level })}
          />
        </div>
      </div>
    </>
  );
}

function SettingRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-desc">{desc}</div>
      </div>
      <div className={`switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
        <div className="switch-knob" />
      </div>
    </div>
  );
}
