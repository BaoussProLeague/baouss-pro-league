import { isFplDownError } from "../lib/fplErrors";

export { isFplDownError };


// Matches FPL's own tone when their site is down for maintenance/updates
// ("The game is updating and will be available soon") rather than
// showing a raw error dump with URLs and status codes - same friendly
// message everywhere this could happen, not a one-off fix on one page.
export default function ErrorCard({ error, onRetry, label = "load" }) {
  if (isFplDownError(error)) {
    return (
      <div className="card error">
        <p style={{ marginBottom: 10, fontWeight: 600 }}>The game is updating and will be available soon.</p>
        <p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>FPL's own servers are briefly unavailable, usually right around a deadline - this isn't something wrong here, just wait a moment and try again.</p>
        {onRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    );
  }
  return (
    <div className="card error">
      <p style={{ marginBottom: 10 }}>Couldn't {label}: {error}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
