import { useId } from 'react'
import type { ProviderId } from '../../../shared/providers'
import { ClaudeIcon } from './ClaudeIcon'

// Logos dos agentes, do tamanho do ClaudeIcon. Desenhos do LobeHub Icons (@lobehub/icons-static-svg
// 1.95.1, licença MIT): Codex no degradê da marca, sem o quadrado branco do ícone do app; Gemini com
// a estrela colorida; Cursor monocromático, na cor do texto em volta (a marca dele é assim). Os ids
// dos degradês são únicos por desenho: o mesmo id repetido some quando um dos logos está escondido.

const CODEX = 'M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z'
const GEMINI = 'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z'
const CURSOR = 'M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z'

type Props = { size?: number }

function CodexLogo({ size = 14 }: Props) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="12" x2="12" y1="3" y2="21">
          <stop stopColor="#B1A7FF" />
          <stop offset=".5" stopColor="#7A9DFF" />
          <stop offset="1" stopColor="#3941FF" />
        </linearGradient>
      </defs>
      <path d={CODEX} fill={`url(#${id})`} />
    </svg>
  )
}

function GeminiLogo({ size = 14 }: Props) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}r`} gradientUnits="userSpaceOnUse" x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}y`} gradientUnits="userSpaceOnUse" x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={GEMINI} fill="#3186FF" />
      <path d={GEMINI} fill={`url(#${id}g)`} />
      <path d={GEMINI} fill={`url(#${id}r)`} />
      <path d={GEMINI} fill={`url(#${id}y)`} />
    </svg>
  )
}

function CursorLogo({ size = 14 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" className="shrink-0">
      <path d={CURSOR} />
    </svg>
  )
}

const LOGOS: Record<ProviderId, (p: Props) => React.JSX.Element> = { codex: CodexLogo, gemini: GeminiLogo, cursor: CursorLogo }

export function AgentIcon({ provider, size = 14 }: { provider?: ProviderId; size?: number }) {
  if (!provider) return <ClaudeIcon size={size} />
  const Logo = LOGOS[provider]
  return <Logo size={size} />
}

// Para listas de menu, que recebem o componente do ícone.
export const AGENT_MENU_ICONS: Record<ProviderId, (p: Props) => React.JSX.Element> = LOGOS
