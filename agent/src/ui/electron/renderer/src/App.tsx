import { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { AppsPage } from "./pages/AppsPage";
import { SettingsPage } from "./pages/SettingsPage";

type Tab = "dashboard" | "apps" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const notify = (text: string, kind: "success" | "error" = "success") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-title">Stream Deck Agent</div>
        <button className={navClass(tab, "dashboard")} onClick={() => setTab("dashboard")}>
          🏠 Dashboard
        </button>
        <button className={navClass(tab, "apps")} onClick={() => setTab("apps")}>
          📦 Aplicativos
        </button>
        <button className={navClass(tab, "settings")} onClick={() => setTab("settings")}>
          ⚙️ Configurações
        </button>
      </nav>

      <main className="content">
        {tab === "dashboard" && (
          <DashboardPage
            onOpenApps={() => setTab("apps")}
            onOpenSettings={() => setTab("settings")}
          />
        )}
        {tab === "apps" && <AppsPage notify={notify} />}
        {tab === "settings" && <SettingsPage notify={notify} />}
      </main>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

function navClass(tab: Tab, target: Tab): string {
  return `nav-item${tab === target ? " active" : ""}`;
}
