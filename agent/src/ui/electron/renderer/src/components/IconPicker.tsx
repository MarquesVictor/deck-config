import { ICONS } from "@stream-deck/shared";

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="icon-grid">
      {Object.entries(ICONS).map(([id, emoji]) => (
        <button
          key={id}
          type="button"
          className={`icon-option${value === id ? " selected" : ""}`}
          onClick={() => onChange(id)}
          title={id}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
