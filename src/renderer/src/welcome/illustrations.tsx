import type { ReactNode } from 'react'
import { IS_WIN } from '../platform'

// Ilustrações das boas-vindas: esquemas do próprio app, nas cores do tema (claro ou escuro).
// Todas no mesmo quadro, 360 x 160.

function Art({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 360 160" role="img" aria-label={label} className="h-full w-full" fontFamily="inherit">
      <defs>
        <pattern id="welcome-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" className="fill-dots" />
        </pattern>
      </defs>
      <rect width="360" height="160" fill="url(#welcome-dots)" />
      {children}
    </svg>
  )
}

// Bloco de pasta: cabeçalho com o nome e uma linha por conversa, com a bolinha do estado.
function Card({ x, y, w, name, rows }: { x: number; y: number; w: number; name: string; rows: string[] }) {
  const h = 30 + rows.length * 16
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="8" className="fill-surface stroke-line" strokeWidth="1" />
      <rect x="10" y="10" width="10" height="8" rx="2" className="fill-muted" />
      <text x="26" y="18" fontSize="9" fontWeight="600" className="fill-text">
        {name}
      </text>
      {rows.map((color, i) => (
        <g key={i} transform={`translate(10 ${30 + i * 16})`}>
          <circle cx="3" cy="3" r="3" className={color} />
          <rect x="11" y="1" width={w - 40 - (i % 2) * 18} height="4" rx="2" className="fill-surface-2" />
        </g>
      ))}
    </g>
  )
}

export function CanvasArt() {
  return (
    <Art label="Pastas de projeto como blocos no canvas, com o estado de cada conversa">
      <Card x={26} y={30} w={130} name="site" rows={['fill-running', 'fill-done', 'fill-done']} />
      <Card x={182} y={16} w={150} name="api" rows={['fill-needs-you', 'fill-done']} />
      <Card x={182} y={92} w={150} name="app-mobile" rows={['fill-running']} />
    </Art>
  )
}

// Moldura de grupo com a etiqueta colorida em cima. As classes vão por extenso: o Tailwind só gera
// as que aparecem inteiras no código.
const GROUP_COLORS = {
  trabalho: { frame: 'fill-area-trabalho/10 stroke-area-trabalho/60', pill: 'fill-area-trabalho' },
  pessoal: { frame: 'fill-area-pessoal/10 stroke-area-pessoal/60', pill: 'fill-area-pessoal' }
}

function Group({ x, y, w, h, name, color }: { x: number; y: number; w: number; h: number; name: string; color: keyof typeof GROUP_COLORS }) {
  const c = GROUP_COLORS[color]
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="10" className={c.frame} strokeWidth="1" />
      <rect x="10" y="-8" width={name.length * 6 + 14} height="16" rx="8" className={c.pill} />
      <text x="17" y="3.5" fontSize="9" fontWeight="600" fill="#fff">
        {name}
      </text>
    </g>
  )
}

export function OrganizeArt() {
  return (
    <Art label="Blocos organizados em grupos coloridos, com um bloco sendo arrastado">
      <Group x={14} y={22} w={186} h={124} name="Trabalho" color="trabalho" />
      <Card x={26} y={38} w={78} name="api" rows={['fill-done']} />
      <Card x={112} y={38} w={78} name="site" rows={['fill-running']} />
      <Card x={26} y={94} w={78} name="docs" rows={['fill-done']} />
      <Group x={222} y={22} w={124} h={124} name="Pessoal" color="pessoal" />
      <Card x={234} y={38} w={100} name="blog" rows={['fill-done']} />
      {/* Bloco no meio do arrasto, inclinado, com o cursor em cima. */}
      <g transform="translate(150 96) rotate(-6)" opacity="0.95">
        <Card x={0} y={0} w={86} name="freela" rows={['fill-needs-you']} />
      </g>
      <path d="M214 112 l0 15 l4 -4 l3 7 l3 -1.5 l-3 -7 l5.5 0 z" className="fill-text stroke-bg" strokeWidth="1" />
    </Art>
  )
}

export function ChatArt() {
  const prompt = IS_WIN ? 'PS C:\\proj>' : '~/proj ❯'
  return (
    <Art label="Conversa com o Claude ao lado de um terminal">
      <g transform="translate(16 14)">
        <rect width="196" height="132" rx="8" className="fill-surface stroke-line" strokeWidth="1" />
        <rect x="10" y="10" width="70" height="6" rx="3" className="fill-surface-2" />
        {/* Sua mensagem, à direita. */}
        <rect x="96" y="26" width="90" height="18" rx="8" className="fill-surface-2" />
        <rect x="104" y="33" width="60" height="4" rx="2" className="fill-muted" />
        {/* Resposta e um diff da edição. */}
        <circle cx="14" cy="56" r="3" className="fill-done" />
        <rect x="22" y="54" width="120" height="4" rx="2" className="fill-muted" />
        <rect x="22" y="64" width="90" height="4" rx="2" className="fill-muted" />
        <rect x="22" y="78" width="164" height="42" rx="6" className="fill-bg stroke-line" strokeWidth="1" />
        <rect x="22" y="86" width="164" height="10" className="fill-red-400/15" />
        <rect x="30" y="89" width="80" height="4" rx="2" className="fill-red-400" />
        <rect x="22" y="100" width="164" height="10" className="fill-done/15" />
        <rect x="30" y="103" width="110" height="4" rx="2" className="fill-done" />
      </g>
      {/* O terminal é escuro nos dois temas, como no app. */}
      <g transform="translate(224 34)">
        <rect width="122" height="92" rx="8" fill="#141416" className="stroke-line" strokeWidth="1" />
        <text x="10" y="22" fontSize="8.5" fontFamily="ui-monospace, Menlo, Consolas, monospace" fill="#a8a8b2">
          {prompt}
        </text>
        <text x="10" y="38" fontSize="8.5" fontFamily="ui-monospace, Menlo, Consolas, monospace" fill="#f0f0f2">
          claude
        </text>
        <rect x="10" y="46" width="6" height="10" fill="#34d399" />
      </g>
    </Art>
  )
}

export function AgentsArt() {
  const projects = [16, 132, 248]
  return (
    <Art label="Biblioteca de agentes ligada a vários projetos">
      {projects.map((x) => (
        <path key={x} d={`M180 58 C180 84 ${x + 48} 80 ${x + 48} 108`} className="stroke-line-strong" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
      ))}
      <g transform="translate(118 12)">
        <rect width="124" height="46" rx="10" className="fill-surface stroke-line-strong" strokeWidth="1" />
        {/* Robozinho do botão Agentes. */}
        <rect x="14" y="14" width="20" height="16" rx="4" className="fill-none stroke-text" strokeWidth="1.6" />
        <circle cx="20.5" cy="22" r="1.6" className="fill-text" />
        <circle cx="27.5" cy="22" r="1.6" className="fill-text" />
        <path d="M24 14 v-4" className="stroke-text" strokeWidth="1.6" />
        <text x="44" y="22" fontSize="9.5" fontWeight="600" className="fill-text">
          Agentes
        </text>
        <text x="44" y="34" fontSize="8" className="fill-faint">
          revisor, testador…
        </text>
      </g>
      {projects.map((x, i) => (
        <g key={x} transform={`translate(${x} 108)`}>
          <rect width="96" height="36" rx="8" className="fill-surface stroke-line" strokeWidth="1" />
          <rect x="10" y="10" width="10" height="8" rx="2" className="fill-muted" />
          <rect x="26" y="12" width={44 - i * 6} height="4" rx="2" className="fill-surface-2" />
          {i === 1 && (
            <g transform="translate(26 21)">
              <rect width="46" height="11" rx="5.5" className="fill-running/20" />
              <text x="6" y="8" fontSize="7.5" fontWeight="600" className="fill-running">
                @revisor
              </text>
            </g>
          )}
        </g>
      ))}
    </Art>
  )
}

// Janela do sistema com a lista do que precisa estar pronto. Mac: os três círculos à esquerda;
// Windows: os botões à direita e o Git na lista.
export function SetupArt() {
  const items = IS_WIN ? ['Claude Code', 'Git for Windows', 'Sua conta'] : ['Claude Code', 'Sua conta']
  return (
    <Art label={`Configuração do Claude Code no ${IS_WIN ? 'Windows' : 'macOS'}`}>
      <g transform="translate(70 14)">
        <rect width="220" height="132" rx="10" className="fill-surface stroke-line-strong" strokeWidth="1" />
        <path d="M0 26 h220" className="stroke-line" strokeWidth="1" />
        {IS_WIN ? (
          <g className="stroke-muted" strokeWidth="1.2" fill="none">
            <path d="M168 13 h8" />
            <rect x="184" y="9" width="8" height="8" />
            <path d="M200 9 l8 8 M208 9 l-8 8" />
          </g>
        ) : (
          <g>
            <circle cx="14" cy="13" r="4" fill="#ff5f57" />
            <circle cx="27" cy="13" r="4" fill="#febc2e" />
            <circle cx="40" cy="13" r="4" fill="#28c840" />
          </g>
        )}
        {/* Faísca do Claude. */}
        <g transform="translate(110 50)" fill="#d97757">
          {[0, 45, 90, 135].map((a) => (
            <rect key={a} x="-1.6" y="-11" width="3.2" height="22" rx="1.6" transform={`rotate(${a})`} />
          ))}
        </g>
        {items.map((label, i) => (
          <g key={label} transform={`translate(${IS_WIN ? 62 : 72} ${(IS_WIN ? 82 : 90) + i * 16})`}>
            <circle cx="5" cy="-3" r="5" className="fill-done" />
            <path d="M2.6 -3 l1.7 1.7 l3.2 -3.4" stroke="#fff" strokeWidth="1.3" fill="none" />
            <text x="16" y="0" fontSize="9" className="fill-text">
              {label}
            </text>
          </g>
        ))}
      </g>
    </Art>
  )
}
