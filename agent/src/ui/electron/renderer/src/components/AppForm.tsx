import { useState } from "react";
import type { App } from "@stream-deck/shared";
import type { AppInput } from "../../../ipc";
import { IconPicker } from "./IconPicker";

interface Props {
  initial?: App;
  onCancel: () => void;
  onSubmit: (input: AppInput) => Promise<void>;
}

export function AppForm({ initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [path, setPath] = useState(initial?.action.path ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "box");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleBrowse = async () => {
    const picked = await window.streamDeck.pickExecutable();
    if (picked) setPath(picked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Informe um nome.");
    if (!path.trim()) return setError("Selecione o executável.");

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), path: path.trim(), icon });
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-field">
        <label>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter-Strike 2" autoFocus />
      </div>

      <div className="form-field">
        <label>Executável</label>
        <div className="form-row">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:\Games\CS2\cs2.exe"
            style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}
          />
          <button type="button" className="btn btn-sm" onClick={handleBrowse}>
            Procurar
          </button>
        </div>
      </div>

      <div className="form-field">
        <label>Ícone</label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 12.5, margin: 0 }}>{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
