import { UserRound } from 'lucide-react';

// Foto da conta do Argus (já baixada pelo processo principal, como data:), as iniciais quando não
// há foto, ou o boneco cinza sem conta, como no Ajustes do Sistema.
export function Avatar({ name, src, size }: { name: string | null; src: string | null; size: number }) {
  const box = { width: size, height: size };
  if (src) return <img src={src} alt="" draggable={false} className="shrink-0 rounded-full object-cover" style={box} />;
  if (!name) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-line-strong text-white" style={box}>
        <UserRound size={Math.round(size * 0.58)} />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white"
      style={{ ...box, fontSize: Math.round(size * 0.4) }}
    >
      {initials || '?'}
    </span>
  );
}
