import { VISIBILITIES, VISIBILITY_LABELS, Visibility } from "@/lib/visibility";

type VisibilitySelectProps = {
  id: string;
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  disabled?: boolean;
  help?: string;
};

export function VisibilitySelect({ id, value, onChange, disabled, help }: VisibilitySelectProps) {
  return (
    <div>
      <label htmlFor={id} className="form-label">Sichtbarkeitsstufe</label>
      <select
        id={id}
        className="form-select"
        value={value}
        onChange={(event) => onChange(event.target.value as Visibility)}
        disabled={disabled}
      >
        {VISIBILITIES.map((visibility) => (
          <option key={visibility} value={visibility}>
            {VISIBILITY_LABELS[visibility]}
          </option>
        ))}
      </select>
      {help && <p className="form-help">{help}</p>}
    </div>
  );
}
