import { useState } from "react";
import type { App } from "@stream-deck/shared";
import type { AppInput } from "../../../ipc";
import { IconPicker } from "./IconPicker";

interface Props {
  initial?: App;
  onCancel: () => void;
  onSubmit: (input: AppInput) => Promise<void>;
}

/** "/Applications/Discord.app" -> "Discord", "C:\Games\CS2\cs2.exe" -> "cs2" */
function deriveNameFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  const base = segments[segments.length - 1] ?? "";
  return base.replace(/\.(app|exe)$/i, "");
}

export function AppForm({ initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [path, setPath] = useState(initial?.action.path ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "box");
  const [systemIcon, setSystemIcon] = useState<string | null>(initial?.iconImage ?? null);
  // Once the user explicitly picks an emoji, the system icon (if any) stops
  // being the active choice — but stays fetched, so clicking it again in
  // the picker re-selects it without a second lookup.
  const [manualOverride, setManualOverride] = useState(!initial?.iconImage && !!initial);
  const [fetchingIcon, setFetchingIcon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usingSystemIcon = systemIcon !== null && !manualOverride;

  const handleBrowse = async () => {
    const picked = await window.streamDeck.pickExecutable();
    if (!picked) return;
    setPath(picked);
    // New apps have no name or icon to protect yet, so fill both in right
    // away. Editing an existing app never overwrites either automatically —
    // the icon keeps its manual button, and the name is left as typed.
    if (!initial) {
      if (!name.trim()) setName(deriveNameFromPath(picked));
      await fetchIconFor(picked);
    }
  };

  const fetchIconFor = async (targetPath: string) => {
    if (!targetPath.trim()) return;
    setFetchingIcon(true);
    try {
      const image = await window.streamDeck.getFileIcon(targetPath.trim());
      setSystemIcon(image);
      setManualOverride(image === null);
    } finally {
      setFetchingIcon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Informe um nome.");
    if (!path.trim()) return setError("Selecione o executável.");

    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        path: path.trim(),
        icon,
        iconImage: usingSystemIcon ? (systemIcon ?? undefined) : undefined,
      });
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Counter-Strike 2"
          autoFocus
        />
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
        <IconPicker
          value={icon}
          onChange={(id) => {
            setIcon(id);
            setManualOverride(true);
          }}
          systemIconUrl={systemIcon}
          usingSystemIcon={usingSystemIcon}
          onSelectSystemIcon={() => setManualOverride(false)}
        />
        {initial && (
          <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fetchIconFor(path)}
              disabled={fetchingIcon || !path.trim()}
            >
              {fetchingIcon ? "Buscando..." : "Buscar ícone do aplicativo"}
            </button>
          </div>
        )}
        {fetchingIcon && <p className="form-hint">Buscando ícone do aplicativo...</p>}
        {!fetchingIcon && systemIcon === null && (
          <p className="form-hint">
            Nenhum ícone encontrado ainda — usando o emoji selecionado acima.
          </p>
        )}
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
