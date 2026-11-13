// Shared loading and error states for panels.

interface SkeletonProps {
  rows?: number;
  height?: number; // a single block of this height instead of rows (e.g. charts)
}

export function Skeleton({ rows = 3, height }: SkeletonProps) {
  if (height) {
    return <div className="skeleton skeleton-block" style={{ height }} aria-label="Loading" role="status" />;
  }
  return (
    <div className="skeleton-rows" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  what: string; // e.g. "devices"
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ what, message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p>
        <strong>Couldn't load {what}.</strong> {message}
      </p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
