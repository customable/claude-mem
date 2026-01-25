/**
 * ApiKeyInput Component
 *
 * Password-style input with show/hide toggle for API keys.
 */

import { useState } from 'react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ApiKeyInput({
  value,
  onChange,
  placeholder = 'Enter API key...',
}: ApiKeyInputProps) {
  const [show, setShow] = useState(false);

  return (
    <label className="input input-bordered flex items-center gap-2 w-full">
      <span className="iconify ph--key size-4 text-base-content/50" />
      <input
        type={show ? 'text' : 'password'}
        className="grow"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle"
        onClick={() => setShow(!show)}
      >
        <span className={`iconify ${show ? 'ph--eye-slash' : 'ph--eye'} size-4`} />
      </button>
    </label>
  );
}
