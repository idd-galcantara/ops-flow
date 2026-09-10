import { CircleAlert } from 'lucide-react';
import type { TargetError } from '../types';
import { targetKey } from '../types';

/**
 * Surfaces per-target failures without hiding the results that did come back.
 * A cluster that is unreachable must never make the successful clusters
 * disappear from the unified view.
 */
export function TargetErrorBanner({ errors }: { errors: TargetError[] }) {
  if (errors.length === 0) return null;

  return (
    <section className="target-error-banner" role="alert" aria-label="Failed targets">
      <div className="target-error-heading">
        <span className="target-error-icon">
          <CircleAlert size={15} />
        </span>
        <div>
          <strong>
            {errors.length} {errors.length === 1 ? 'target failed' : 'targets failed'}
          </strong>
          <small>The targets below did not respond. All other results are still shown.</small>
        </div>
      </div>
      <ul className="target-error-list">
        {errors.map((err) => (
          <li key={targetKey(err.target)}>
            <span className="target-error-target">{targetKey(err.target)}</span>
            <span className="target-error-message">{err.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
