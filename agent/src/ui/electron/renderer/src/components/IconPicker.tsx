import { ICONS } from "@stream-deck/shared";

interface Props {
  value: string;
  onChange: (icon: string) => void;
  systemIconUrl?: string | null;
  usingSystemIcon: boolean;
  onSelectSystemIcon: () => void;
}

export function IconPicker({ value, onChange, systemIconUrl, usingSystemIcon, onSelectSystemIcon }: Props) {
  return (
    <div className="icon-grid">
      {systemIconUrl && (
        <button
          type="button"
          className={`icon-option${usingSystemIcon ? " selected" : ""}`}
          onClick={onSelectSystemIcon}
          title="Ícone do aplicativo"
        >
          <img className="icon-option-image" src={systemIconUrl} alt="" />
        </button>
      )}
      {Object.entries(ICONS).map(([id, emoji]) => (
        <button
          key={id}
          type="button"
          className={`icon-option${!usingSystemIcon && value === id ? " selected" : ""}`}
          onClick={() => onChange(id)}
          title={id}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
