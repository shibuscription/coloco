type SelectOption = {
  value: string;
  label: string;
};

type HighlightControlsProps = {
  toneValue: string;
  hueValue: string;
  onToneChange: (value: string) => void;
  onHueChange: (value: string) => void;
  toneOptions: SelectOption[];
  hueOptions: SelectOption[];
};

export function HighlightControls({
  toneValue,
  hueValue,
  onToneChange,
  onHueChange,
  toneOptions,
  hueOptions,
}: HighlightControlsProps) {
  return (
    <div className="highlight-controls">
      <div className="control-group">
        <label htmlFor="tone-highlight">トーン強調</label>
        <select
          id="tone-highlight"
          className="control-select"
          value={toneValue}
          onChange={(event) => onToneChange(event.target.value)}
        >
          <option value="">選択しない</option>
          {toneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label htmlFor="hue-highlight">色相強調</label>
        <select
          id="hue-highlight"
          className="control-select"
          value={hueValue}
          onChange={(event) => onHueChange(event.target.value)}
        >
          <option value="">選択しない</option>
          {hueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
