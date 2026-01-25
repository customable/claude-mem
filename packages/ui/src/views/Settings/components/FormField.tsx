/**
 * FormField Component
 *
 * Reusable form field wrapper with label, hint, and error support.
 */

import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  hint?: string;
  badge?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, hint, badge, error, children }: FormFieldProps) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend flex items-center gap-2">
        {label}
        {badge}
      </legend>
      {children}
      {error ? (
        <p className="fieldset-label text-error flex items-center gap-1">
          <span className="iconify ph--warning-circle size-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="fieldset-label text-base-content/60">{hint}</p>
      ) : null}
    </fieldset>
  );
}
