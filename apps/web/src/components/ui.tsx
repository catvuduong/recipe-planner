import type { ReactNode } from 'react';

// Shared presentational pieces. None of these hold state, so they can render on the server.

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel state state--error" role="alert">
      <span className="state__icon" aria-hidden="true">
        🫕
      </span>
      <h2>Something went wrong</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel state">
      <span className="state__icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function InlineAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="alert" role="alert">
      <span>{message}</span>
      <button type="button" className="btn btn--small" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
