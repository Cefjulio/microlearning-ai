interface ProgressBarProps {
  percentage: number;
  label?: string;
  color?: string;
  height?: number;
}

export default function ProgressBar({ percentage, label, color = '#6C63FF', height = 8 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className="progress-bar-wrapper">
      {label && (
        <div className="progress-bar-label">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className="progress-bar-track" style={{ height }}>
        <div
          className="progress-bar-fill"
          style={{ width: `${clamped}%`, backgroundColor: color, height }}
        />
      </div>
    </div>
  );
}
