import type { HighlightState } from "../utils/highlight";

type SelectOption = {
  value: string;
  label: string;
};

type HighlightControlsProps = {
  highlight: HighlightState;
  onChange: (next: HighlightState) => void;
  toneOptions: SelectOption[];
  hueOptions: SelectOption[];
  bare?: boolean;
};

export function HighlightControls({
  highlight,
  onChange,
  toneOptions,
  hueOptions,
  bare = false,
}: HighlightControlsProps) {
  const content = (
    <>
      <div className="control-group">
        <label>表示モード</label>
        <div className="inline-controls">
          <button
            className={`control-button ${highlight.type === "none" ? "active" : ""}`}
            type="button"
            onClick={() => onChange({ type: "none" })}
          >
            強調なし
          </button>
          <button
            className={`control-button ${highlight.type === "achromatic" ? "active" : ""}`}
            type="button"
            onClick={() => onChange({ type: "achromatic" })}
          >
            無彩色 5点
          </button>
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="tone-highlight">トーン強調</label>
        <select
          id="tone-highlight"
          className="control-select"
          value={highlight.type === "tone" ? highlight.value : ""}
          onChange={(event) =>
            onChange(event.target.value ? { type: "tone", value: event.target.value } : { type: "none" })
          }
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
          value={highlight.type === "hue" ? highlight.value : ""}
          onChange={(event) =>
            onChange(event.target.value ? { type: "hue", value: event.target.value } : { type: "none" })
          }
        >
          <option value="">選択しない</option>
          {hueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  if (bare) {
    return <div className="highlight-controls">{content}</div>;
  }

  return <section className="panel highlight-panel">{content}</section>;
}
