import { useEffect, useRef, useState } from "react";
import { iconFor, type App } from "@stream-deck/shared";
import type { AppInput } from "../../../ipc";
import { AppForm } from "../components/AppForm";

interface Props {
  notify: (text: string, kind?: "success" | "error") => void;
}

type EditingState = "new" | { id: string } | null;

export function AppsPage({ notify }: Props) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingState>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // dragstart's e.target is always the draggable row itself in Chromium,
  // never the inner handle span, so "did this drag start from the handle"
  // has to be tracked via mousedown on the handle instead of e.target.
  const dragAllowedRef = useRef(false);

  const refresh = () => window.streamDeck.listApps().then(setApps);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const handleAdd = async (input: AppInput) => {
    await window.streamDeck.addApp(input);
    setEditing(null);
    await refresh();
    notify(`"${input.name}" adicionado.`);
  };

  const handleEdit = async (id: string, input: AppInput) => {
    await window.streamDeck.updateApp(id, input);
    setEditing(null);
    await refresh();
    notify(`"${input.name}" atualizado.`);
  };

  const handleDelete = async (app: App) => {
    if (!confirm(`Remover "${app.name}"?`)) return;
    await window.streamDeck.deleteApp(app.id);
    await refresh();
    notify(`"${app.name}" removido.`);
  };

  const handleTest = async (app: App) => {
    setTestingId(app.id);
    try {
      const result = await window.streamDeck.testApp(app.id);
      if (result.ok) {
        notify(`"${app.name}" aberto com sucesso.`);
      } else {
        notify(result.message, "error");
      }
    } finally {
      setTestingId(null);
    }
  };

  const editingApp = editing && editing !== "new" ? apps.find((a) => a.id === editing.id) : undefined;

  const handleDragStart = (e: React.DragEvent, app: App) => {
    if (!dragAllowedRef.current) {
      e.preventDefault();
      return;
    }
    setDraggingId(app.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", app.id);
  };

  const handleDragOver = (e: React.DragEvent, overApp: App) => {
    // Always preventDefault here, even over the dragged row itself — the
    // browser only fires "drop" on elements where dragover opted in.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingId && draggingId !== overApp.id) setOverId(overApp.id);
  };

  // Reordering happens on drop, not live during dragover: moving DOM nodes
  // mid-drag (via a state update while the row under the pointer is still
  // part of an active native drag gesture) confuses the browser's drag
  // tracking and the UI stops responding to further dragover events.
  const handleDrop = async (e: React.DragEvent, overApp: App) => {
    e.preventDefault();
    setOverId(null);
    const from = apps.findIndex((a) => a.id === draggingId);
    const to = apps.findIndex((a) => a.id === overApp.id);
    setDraggingId(null);
    if (from === -1 || to === -1 || from === to) return;

    const next = [...apps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setApps(next);
    await window.streamDeck.reorderApps(next.map((a) => a.id));
  };

  const handleDragEnd = () => {
    dragAllowedRef.current = false;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <>
      <div className="page-header">
        <h1>Aplicativos</h1>
        <p>Aplicativos que aparecem como botões no celular.</p>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="stat-label" style={{ marginBottom: 14 }}>
            {editing === "new" ? "Novo aplicativo" : "Editar aplicativo"}
          </div>
          <AppForm
            initial={editingApp}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => (editing === "new" ? handleAdd(input) : handleEdit(editingApp!.id, input))}
          />
        </div>
      )}

      {!editing && (
        <div className="form-actions" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            + Adicionar aplicativo
          </button>
        </div>
      )}

      {loading ? null : apps.length === 0 ? (
        <div className="empty-state">
          Nenhum aplicativo configurado ainda.
          <br />
          Adicione um para que ele apareça no celular.
        </div>
      ) : (
        <div className="app-list">
          {apps.map((app) => (
            <div
              key={app.id}
              className={`app-row${draggingId === app.id ? " dragging" : ""}${overId === app.id ? " drag-over" : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, app)}
              onDragOver={(e) => handleDragOver(e, app)}
              onDrop={(e) => handleDrop(e, app)}
              onDragEnd={handleDragEnd}
            >
              <span
                className="drag-handle"
                title="Arrastar para reordenar"
                onMouseDown={() => {
                  dragAllowedRef.current = true;
                }}
              >
                ⠿
              </span>
              <span className="app-row-icon">
                {app.iconImage ? (
                  <img className="app-row-icon-image" src={app.iconImage} alt="" />
                ) : (
                  iconFor(app.icon)
                )}
              </span>
              <div className="app-row-body">
                <div className="app-row-name">{app.name}</div>
                <div className="app-row-path">{app.action.path}</div>
              </div>
              <div className="app-row-actions">
                <button className="btn btn-sm" onClick={() => handleTest(app)} disabled={testingId === app.id}>
                  {testingId === app.id ? "Testando..." : "Testar"}
                </button>
                <button className="btn btn-sm" onClick={() => setEditing({ id: app.id })}>
                  Editar
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(app)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
