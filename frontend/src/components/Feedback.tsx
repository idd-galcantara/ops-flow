import { CircleAlert, Loader } from 'lucide-react';

/**
 * Shared loading and error primitives, so every surface in ops-flow reports
 * progress and failure the same way.
 */

/** Inline spinner + message, for content that is being fetched. */
export function LoadingState({ message }: { message: string }) {
  return (
    <p className="feedback-loading" role="status" aria-live="polite">
      <Loader size={14} className="spinning" /> {message}
    </p>
  );
}

/** Inline error, always announced to assistive tech. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feedback-error" role="alert">
      <CircleAlert size={14} />
      <span className="feedback-error-message">{message}</span>
      {onRetry && (
        <button type="button" className="text-button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Centered empty/placeholder state with an icon. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
