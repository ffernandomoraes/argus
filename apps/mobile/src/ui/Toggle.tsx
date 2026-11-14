// Chave liga/desliga no estilo do iOS.
export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-green' : 'bg-code'}`}
    >
      <span className={`absolute top-[2px] size-[22px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[20px]' : 'left-[2px]'}`} />
    </button>
  );
}
