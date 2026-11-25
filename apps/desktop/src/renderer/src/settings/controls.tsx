import type { ReactNode } from 'react';
import { InfoTip } from '../ui/InfoTip';

// O campo de escolha mora no próprio arquivo; sai daqui também, como antes.
export { Select, type SelectOption } from './Select';

// Controles das configurações (e de quem segue o mesmo desenho, como a biblioteca de agentes). O
// botão com borda daqui virou o Button da base (ui/Button, variante secondary).

// Ícone num quadradinho colorido, como os do Ajustes do Sistema. `color` é o fundo; o ícone é branco.
// `soft`: versão discreta, com o fundo só tingido da cor e o ícone na própria cor.
export function IconTile({
  color,
  size = 20,
  soft,
  children,
}: {
  color: string
  size?: number
  soft?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${soft ? '' : 'text-white shadow-sm shadow-black/20'}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        ...(soft
          ? { color, background: `color-mix(in srgb, ${color} 16%, transparent)` }
          : { background: `linear-gradient(180deg, color-mix(in srgb, ${color} 82%, white), ${color})` }),
      }}
    >
      {children}
    </span>
  );
}

// Lista de linhas (Row), separadas por uma linha tracejada. Sem cartão nem espaço entre um grupo e o
// seguinte: a linha de baixo do grupo continua a lista, e a página fica uma lista só. O último da
// página não tem linha.
export function Group({ children }: { children: ReactNode }) {
  return <div className="border-b border-dashed border-line last:border-0">{children}</div>;
}

// Linha de configuração: rótulo e explicação à esquerda, controle sempre à direita (o padrão de
// todas as páginas; nada de controle na linha de baixo). Sem espaço, quem encolhe é o texto, que
// quebra em mais linhas; o controle fica inteiro. Controle largo demais para a direita (muitas
// opções lado a lado) vira Select, e rótulo comprido fica curto, com o detalhe na explicação.
// info: explicação longa, num ícone ao lado do rótulo que abre ao passar o mouse. A description
// fica com uma frase curta; texto de várias linhas embaixo do rótulo pesava a tela.
export function Row({
  label,
  description,
  info,
  tag,
  children,
}: {
  label: string
  description?: string
  info?: string
  // Etiqueta ao lado do rótulo (ex.: o tipo do item, "Skill").
  tag?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-dashed border-line py-5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[16px] text-text">
          {label}
          {info && <InfoTip text={info} />}
          {tag && <span className="ml-1.5 flex">{tag}</span>}
        </div>
        {description && <div className="mt-0.5 text-[15px] leading-relaxed text-muted">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  // disabled: a opção fica à vista, apagada, com o motivo em `title`.
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean; title?: string }[]
  onChange: (value: T) => void
}) {
  return (
    // Trilho de 36 px com borda, como os campos; o escolhido fica num "chip" (Head Desk).
    <div className="inline-flex h-9 items-stretch rounded-xl border border-line bg-fill p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[15px] disabled:opacity-40 ${
            value === o.value ? 'bg-control text-text shadow-sm shadow-black/20' : 'text-muted enabled:hover:text-text'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-accent' : 'bg-line-strong'}`}
    >
      <span className={`size-5 rounded-full bg-white shadow-sm shadow-black/30 transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}
