// O nome do grupo como no canvas: pílula na cor do grupo escurecida (o branco lê bem em toda a
// paleta), em maiúsculas. Com mais de um workspace, o nome dele vem antes.
export function GroupLabel({ label, color, workspace }: { label: string; color?: string; workspace?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {workspace && <span className="truncate">{workspace} -</span>}
      <span
        className={`inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-[11px] font-semibold tracking-wide uppercase ${color ? 'text-white' : 'bg-code text-muted'}`}
        style={color ? { background: `color-mix(in srgb, ${color} 65%, black)` } : undefined}
      >
        {label}
      </span>
    </span>
  );
}
