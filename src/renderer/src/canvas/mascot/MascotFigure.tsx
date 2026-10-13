import { memo, type CSSProperties, type ReactNode } from 'react'

// Desenho do mascote em vetor: cabeça grande e corpo pequeno, cabelo curto castanho-claro com as
// laterais mais baixas, sobrancelha grossa, olhos verde-acinzentados, barba rala com bigode,
// camiseta amarela gola careca e calça preta.
// Cada parte que mexe fica num Pivot (ombro, cotovelo, pescoço, quadril, pés); as poses e as
// animações estão em styles/mascot.css, pela classe pose-* do <svg>.

export type Pose = 'idle' | 'walk' | 'whip' | 'dance' | 'listen' | 'thumbs' | 'wave'

// Área do desenho, em unidades do viewBox. O boneco ocupa x 20-100 e y 5-147; à direita sobra
// espaço para o chicote e, em cima, para a tira na preparação.
export const VIEW = { x: 0, y: -12, w: 200, h: 172 }
// Eixo do corpo (para virar de lado), canto esquerdo do boneco e ponta do chicote no estalo.
export const BODY_X = 60
export const LEFT_EDGE = 20
export const LASH_TIP = { x: 186.5, y: 93 }
// Duração da chicotada; o CSS lê de --whip-ms.
export const WHIP_MS = 1000

// O lado direito é o esquerdo espelhado no eixo do corpo.
const MIRROR = `matrix(-1 0 0 1 ${BODY_X * 2} 0)`

// Gira em volta de (x, y), com os filhos nas coordenadas do desenho. `pose`: classe da posição fixa
// da pose (com transição entre poses); `move`: classe da animação, somada por cima.
function Pivot({ x, y, pose, move, children }: { x: number; y: number; pose?: string; move?: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={pose}>
        <g className={move}>
          <g transform={`translate(${-x} ${-y})`}>{children}</g>
        </g>
      </g>
    </g>
  )
}

type Mouth = 'calm' | 'smile' | 'grin'
type Hand = 'open' | 'fist' | 'thumb'

export const MascotFigure = memo(function MascotFigure({ pose }: { pose: Pose }) {
  const side = pose === 'walk'
  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      width="100%"
      height="100%"
      className={`mascot pose-${pose}`}
      style={{ '--whip-ms': `${WHIP_MS}ms` } as CSSProperties}
    >
      <Defs />
      {/* Sombra no chão: fica parada quando ele pula. */}
      <ellipse cx={60} cy={148.5} rx={22} ry={3.4} fill="#000" opacity={0.22} />
      <Pivot x={60} y={147} move="m-body-move">
        {/* Trocar de frente para perfil remonta o grupo: a animação .m-turn faz o giro. */}
        <Pivot key={side ? 'side' : 'front'} x={60} y={147} move="m-turn">
          {side ? <SideView /> : <FrontView pose={pose} />}
        </Pivot>
      </Pivot>
    </svg>
  )
})

// De frente: todas as poses menos andar.
function FrontView({ pose }: { pose: Pose }) {
  const mouth: Mouth = pose === 'whip' || pose === 'dance' || pose === 'thumbs' ? 'grin' : pose === 'wave' ? 'smile' : 'calm'
  const rightHand: Hand = pose === 'whip' ? 'fist' : pose === 'thumbs' ? 'thumb' : 'open'
  return (
    <>
      {pose === 'whip' && (
        <g className="m-lash-windup">
          <Lash d="M92.7 63.8 C100 40 96 6 76 -3 C58 -10 38 -6 28 6 C24 11 22 18 22 24" />
        </g>
      )}
      <path d="M47 118 L73 118 L73.4 127.5 C68.5 129 64.5 130 60 131 C55.5 130 51.5 129 46.6 127.5 Z" fill="url(#mascot-jeans)" />
      <Pivot x={53.5} y={121} move="m-leg-l-move">
        <Leg />
      </Pivot>
      <g transform={MIRROR}>
        <Pivot x={53.5} y={121} move="m-leg-r-move">
          <Leg />
        </Pivot>
      </g>
      <Pivot x={60} y={124} move="m-torso-move">
        <Torso />
      </Pivot>
      <Pivot x={60} y={90} pose="m-head" move="m-head-move">
        {/* Cabeça 3% mais estreita que o desenho, em volta do eixo do corpo; a altura fica igual. */}
        <g transform={`matrix(0.97 0 0 1 ${BODY_X * 0.03} 0)`}>
          <Head mouth={mouth} />
        </g>
      </Pivot>
      <Arm side="l" hand="open" />
      <g transform={MIRROR}>
        <Arm side="r" hand={rightHand} whip={pose === 'whip'} />
      </g>
      {pose === 'whip' && <Strike />}
      {pose === 'wave' && <Badge />}
      {pose === 'thumbs' && <Sparkles />}
      {pose === 'listen' && <SoundWaves />}
    </>
  )
}

// Só um mascote por janela: os ids podem ser fixos.
function Defs() {
  return (
    <defs>
      <radialGradient id="mascot-skin" cx={54} cy={46} r={46} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor="#f5d4ba" />
        <stop offset={0.55} stopColor="#eabb99" />
        <stop offset={1} stopColor="#d49c7a" />
      </radialGradient>
      <linearGradient id="mascot-limb" x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#dca584" />
        <stop offset={0.45} stopColor="#f0c6a6" />
        <stop offset={1} stopColor="#d9a07f" />
      </linearGradient>
      <linearGradient id="mascot-hair" x1={0} x2={0} y1={0} y2={1}>
        <stop offset={0} stopColor="#8d6544" />
        <stop offset={1} stopColor="#694630" />
      </linearGradient>
      <linearGradient id="mascot-fade" x1={0} x2={0} y1={0} y2={1}>
        <stop offset={0} stopColor="#6a4a33" stopOpacity={0.85} />
        <stop offset={1} stopColor="#6a4a33" stopOpacity={0.1} />
      </linearGradient>
      {/* Barba fraquinha, castanho-claro meio ruivo: quase some na bochecha, aparece mais no queixo. */}
      <linearGradient id="mascot-beard" x1={0} x2={0} y1={50} y2={92} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor="#9a6a45" stopOpacity={0.06} />
        <stop offset={0.45} stopColor="#8a5c3b" stopOpacity={0.2} />
        <stop offset={1} stopColor="#7a4f33" stopOpacity={0.36} />
      </linearGradient>
      {/* Borda esfumada: sem ela a barba parece uma máscara. */}
      <filter id="mascot-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={1.3} />
      </filter>
      <pattern id="mascot-beard-texture" width={2.2} height={2.2} patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <path d="M0.5 0.2 L0.9 1.4" stroke="#5a3a25" strokeWidth={0.4} strokeLinecap="round" />
        <path d="M1.6 1 L1.9 2" stroke="#9a6a45" strokeWidth={0.4} strokeLinecap="round" />
      </pattern>
      <linearGradient id="mascot-lip" x1={0} x2={0} y1={0} y2={1}>
        <stop offset={0} stopColor="#cf8a7f" />
        <stop offset={1} stopColor="#b26c63" />
      </linearGradient>
      <linearGradient id="mascot-shirt" x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#dca61c" />
        <stop offset={0.5} stopColor="#fbd347" />
        <stop offset={1} stopColor="#dca61c" />
      </linearGradient>
      <linearGradient id="mascot-sleeve" x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#e0aa22" />
        <stop offset={0.55} stopColor="#f8cf42" />
        <stop offset={1} stopColor="#e0aa22" />
      </linearGradient>
      <linearGradient id="mascot-jeans" x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#16161a" />
        <stop offset={0.5} stopColor="#2c2d33" />
        <stop offset={1} stopColor="#16161a" />
      </linearGradient>
      {/* A íris fica cortada pelas pálpebras. */}
      <clipPath id="mascot-eye-l">
        <path d={EYE_WHITE} />
      </clipPath>
      <clipPath id="mascot-eye-r">
        <path d={EYE_WHITE} transform="scale(-1 1)" />
      </clipPath>
      <clipPath id="mascot-eye-side">
        <path d={SIDE_EYE_WHITE} />
      </clipPath>
    </defs>
  )
}

// ---------- cabeça ----------

// Rosto oval: a bochecha afina desde a altura dos olhos até o queixo.
const FACE =
  'M30 38 C30 21 42.5 12.5 60 12.5 C77.5 12.5 90 21 90 38 C90 46 89.9 55 88.9 62 C87 75 76 90.6 60 90.6 ' +
  'C44 90.6 33 75 31.1 62 C30.1 55 30 46 30 38 Z'
// Cabelo curto e liso, penteado para cima e um pouco para o lado (topete leve à esquerda da testa);
// contorno sem ondas. A linha da testa é limpa, com as entradas nas têmporas.
const HAIR =
  'M28.6 40 C27 30 29.4 20.4 35.6 14.2 C39.6 10.2 45 6 52 4.2 C58.4 2.8 66.8 3.6 74 5.8 C81 8 87.6 12.4 90.2 19.4 ' +
  'C92.4 25.6 92.6 33 91.4 40 L89.6 39.5 C89.2 33.5 88.4 29.4 86.8 27 C78.6 24.4 69.4 23.2 60 23.6 ' +
  'C50.6 24 41.4 25 33.2 27 C31.6 29.4 30.8 33.5 30.4 39.6 Z'
// Mechas penteadas: saem da testa, sobem e deitam para a direita.
const HAIR_STRANDS = [
  'M35 26.4 C35.6 19.6 39.6 14.4 45 11',
  'M42 25.4 C43.6 17.6 48.6 11.6 55.6 8.2',
  'M50 24.4 C52 16.8 57.4 11.4 64.6 8.6',
  'M58 23.8 C60.4 17 66 12.4 73.4 10.4',
  'M66 23.8 C68.6 17.8 74.2 14 81 13.6',
  'M74 24.6 C76.6 19.6 81 17 86.4 17.8'
]

// Barba rala: costeleta fina, acompanhando a mandíbula até o queixo, com a linha da bochecha
// descendo até o canto da boca.
const BEARD =
  'M30.4 50 C30 54 30.2 58 30.9 62 C32.6 75 43.6 91.4 60 91.4 C76.4 91.4 87.4 75 89.1 62 C89.8 58 90 54 89.6 50 ' +
  'L87.6 50 C87.4 57 85.6 63.4 81 67.6 C76 71 70 70.6 60 70.6 C50 70.6 44 71 39 67.6 C34.4 63.4 32.6 57 32.4 50 Z'
const MUSTACHE = 'M47.5 71.3 C50.5 69.3 55.5 69 60 70.2 C64.5 69 69.5 69.3 72.5 71.3 C69.5 72 65.5 71.8 60 72 C54.5 71.8 50.5 72 47.5 71.3 Z'

function Head({ mouth }: { mouth: Mouth }) {
  return (
    <>
      <Ear />
      <g transform={MIRROR}>
        <Ear />
      </g>
      <path d={FACE} fill="url(#mascot-skin)" />
      <TempleFade />
      <g transform={MIRROR}>
        <TempleFade />
      </g>
      <Hair />
      <ellipse cx={40} cy={58.5} rx={5} ry={2.8} fill="#e88f78" opacity={0.16} />
      <ellipse cx={80} cy={58.5} rx={5} ry={2.8} fill="#e88f78" opacity={0.16} />
      <Brow />
      <g transform={MIRROR}>
        <Brow />
      </g>
      <Eye cx={46} flip={1} />
      <Eye cx={74} flip={-1} />
      <Nose />
      <Beard />
      <MouthShape kind={mouth} />
      <path d={MUSTACHE} fill="#7a5236" opacity={0.45} filter="url(#mascot-soft)" />
      <g stroke="#7a5236" strokeWidth={0.5} strokeLinecap="round" opacity={0.3}>
        <path d="M50 69.6 L48.8 71.2" />
        <path d="M53.2 69 L52.2 71" />
        <path d="M56.4 69 L55.8 71.2" />
        <path d="M70 69.6 L71.2 71.2" />
        <path d="M66.8 69 L67.8 71" />
        <path d="M63.6 69 L64.2 71.2" />
      </g>
    </>
  )
}

function Ear() {
  return (
    <>
      <path d="M31.4 46.8 C27.2 45.4 24.6 49.4 25 54.6 C25.4 59.6 27.6 63.6 31.4 63.2 Z" fill="url(#mascot-skin)" />
      <g fill="none" stroke="#c48a6b" strokeLinecap="round">
        <path d="M29.6 50 C27.6 50.8 27.2 54.8 28.2 58.2" strokeWidth={1.1} />
        <path d="M28.8 53.2 C29.6 53.8 29.8 55.4 29 56.4" strokeWidth={0.9} />
      </g>
    </>
  )
}

// Laterais curtas: o cabelo vai clareando da têmpora até a orelha.
function TempleFade() {
  return <path d="M28.7 36 C28.3 41 28.6 46 30.2 50.4 L32.4 49.6 C31.7 45 31.6 40.5 32.4 35.5 Z" fill="url(#mascot-fade)" />
}

function Hair() {
  return (
    <>
      <path d={HAIR} fill="url(#mascot-hair)" />
      <g fill="none" stroke="#a98059" strokeWidth={0.9} strokeLinecap="round" opacity={0.55}>
        {HAIR_STRANDS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d="M44 9.6 Q56 4.6 70 6.4 Q58 7.6 48 12.6 Z" fill="#fff" opacity={0.12} />
    </>
  )
}

function Brow() {
  return (
    <path
      d="M37.4 40.8 C40.6 38.2 46.6 37.4 53.6 39.4 C54.4 39.7 54.4 41.2 53.5 41.6 C47.4 41.2 42.2 41.4 38.6 43 C37.6 43.4 36.8 41.6 37.4 40.8 Z"
      fill="#4e3423"
    />
  )
}

// Olho com o centro na origem (o direito é espelhado). A íris não espelha: os dois olham para o
// mesmo lado quando a pose mexe nela (.m-iris).
const EYE_WHITE = 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z'

function Eye({ cx, flip }: { cx: number; flip: 1 | -1 }) {
  const mirror = `scale(${flip} 1)`
  return (
    <g transform={`translate(${cx} 49.6)`}>
      <path
        d="M-5 3.1 C-2 4.7 3 4.7 5.6 2.9"
        transform={mirror}
        fill="none"
        stroke="#cf9576"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.35}
      />
      <g className="m-blink">
        <path d={EYE_WHITE} transform={mirror} fill="#fbf6f1" />
        <g clipPath={`url(#mascot-eye-${flip === 1 ? 'l' : 'r'})`}>
          <g className="m-iris">
            <circle r={2.9} fill="#7c8975" stroke="#4b5546" strokeWidth={0.7} />
            <circle r={1.35} fill="#17100b" />
            <circle cx={0.9} cy={-1} r={0.7} fill="#fff" />
          </g>
        </g>
        <g transform={mirror} fill="none" strokeLinecap="round">
          <path d="M-7 0.3 C-4.5 -3.7 4.5 -3.8 7 -0.2" stroke="#2e2018" strokeWidth={1.5} />
          <path d="M-6.8 0 L-8.2 -1" stroke="#2e2018" strokeWidth={1} />
          <path d="M-5.4 1 C-3 3 3.5 3.1 5.8 0.8" stroke="#c58c6e" strokeWidth={0.7} opacity={0.6} />
        </g>
      </g>
      <path
        d="M-5.5 -3.4 C-2.5 -5.2 3.5 -5.4 6.2 -3.6"
        transform={mirror}
        fill="none"
        stroke="#c08667"
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.7}
      />
    </g>
  )
}

function Nose() {
  return (
    <>
      <g fill="none" strokeLinecap="round">
        <path d="M56.8 50.5 C56.4 55 55.6 59.5 54.6 62.6" stroke="#cd9374" strokeWidth={1.5} opacity={0.55} />
        <path d="M63.4 52 C63.8 56 64.6 59.8 65.6 62.4" stroke="#d9a385" strokeWidth={1.1} opacity={0.4} />
      </g>
      <ellipse cx={60} cy={64.4} rx={4.6} ry={2.9} fill="#e0a585" opacity={0.35} />
      <path
        d="M53.4 63.6 C53.6 66.6 56.4 67.8 58.2 67 C59 67.6 61 67.6 61.8 67 C63.6 67.8 66.4 66.6 66.6 63.6"
        fill="none"
        stroke="#b67858"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <ellipse cx={57.3} cy={66.1} rx={1.3} ry={0.7} fill="#93593f" opacity={0.7} transform="rotate(-15 57.3 66.1)" />
      <ellipse cx={62.7} cy={66.1} rx={1.3} ry={0.7} fill="#93593f" opacity={0.7} transform="rotate(15 62.7 66.1)" />
      <ellipse cx={60.4} cy={63} rx={2.1} ry={1.3} fill="#fff" opacity={0.3} />
    </>
  )
}

function Beard() {
  return (
    <>
      <path d={BEARD} fill="url(#mascot-beard)" filter="url(#mascot-soft)" />
      <path d={BEARD} fill="url(#mascot-beard-texture)" opacity={0.16} />
      <ellipse cx={60} cy={81} rx={3.4} ry={2.6} fill="#7a4f33" opacity={0.2} filter="url(#mascot-soft)" />
    </>
  )
}

function MouthShape({ kind }: { kind: Mouth }) {
  if (kind === 'grin') {
    return (
      <>
        <path d="M51 72.6 C55 74.2 65 74.2 69 72.6 C68 79.5 63.5 81.4 60 81.4 C56.5 81.4 52 79.5 51 72.6 Z" fill="#4a1f1c" />
        <path d="M52.2 73.3 C56 74.6 64 74.6 67.8 73.3 L67.2 75.9 C63.5 76.9 56.5 76.9 52.8 75.9 Z" fill="#fbfaf7" />
        <path d="M54.5 79.6 C57 78 63 78 65.5 79.6 C63.5 81 56.5 81 54.5 79.6 Z" fill="#c96b67" />
        <path
          d="M51.6 75 C53 80.5 57 82.3 60 82.3 C63 82.3 67 80.5 68.4 75"
          fill="none"
          stroke="#c47f75"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </>
    )
  }
  // Fechada; no sorriso, os cantos sobem.
  const line = kind === 'smile' ? 'M51.2 72.6 C55 75.2 65 75.2 68.8 72.6' : 'M51.8 73.2 C55.5 74.6 64.5 74.6 68.2 73.2'
  return (
    <>
      <path d="M52.4 73.4 C55 72.9 65 72.9 67.6 73.4 C66.2 76.9 53.8 76.9 52.4 73.4 Z" fill="url(#mascot-lip)" />
      <path d="M52.2 73.2 C55 72 58 72.2 60 72.7 C62 72.2 65 72 67.8 73.2 C65 73.9 55 73.9 52.2 73.2 Z" fill="#b8746a" />
      <path d={line} fill="none" stroke="#7a433c" strokeWidth={1} strokeLinecap="round" />
      <ellipse cx={60} cy={75} rx={3} ry={0.8} fill="#fff" opacity={0.22} />
    </>
  )
}

// ---------- corpo ----------

// Ombros em x 43.5-76.5, afinando até a cintura em x 46-74.
const SHIRT =
  'M46.5 92.4 C50.5 89.6 55 88.6 60 88.6 C65 88.6 69.5 89.6 73.5 92.4 C76 94 76.9 97 76.6 100.5 C76.2 105.5 75 111.5 74 118 ' +
  'L73.6 123.4 C73.5 125 72.7 126 71.4 126 L48.6 126 C47.3 126 46.5 125 46.4 123.4 L46 118 C45 111.5 43.8 105.5 43.4 100.5 ' +
  'C43.1 97 44 94 46.5 92.4 Z'

function Torso() {
  return (
    <>
      <path d={SHIRT} fill="url(#mascot-shirt)" />
      {/* Sombra do queixo no peito e a gola careca. */}
      <ellipse cx={60} cy={99.5} rx={11} ry={4.4} fill="#000" opacity={0.13} />
      <path d="M50 90.4 C53.5 96.4 66.5 96.4 70 90.4" fill="none" stroke="#c9930f" strokeWidth={2.6} strokeLinecap="round" />
      <g fill="none" stroke="#a87a0c" strokeWidth={0.9} strokeLinecap="round" opacity={0.35}>
        <path d="M51 107 Q53.5 111.5 55.5 117" />
        <path d="M69 107 Q66.5 111.5 64.5 117" />
      </g>
      <path d="M46.6 123.4 L73.4 123.4" stroke="#b8860d" strokeWidth={1} opacity={0.5} />
    </>
  )
}

function Leg() {
  return (
    <>
      <path d="M49.8 120 L57.2 120 L56.8 140.6 C56.7 142 56 142.8 54.8 142.8 L52.2 142.8 C51 142.8 50.3 142 50.2 140.6 Z" fill="url(#mascot-jeans)" />
      <path d="M55.6 124 L55.4 139" stroke="#45464e" strokeWidth={0.7} opacity={0.6} />
      <path
        d="M48 143.4 C48 140.2 49.8 139 52 139 L55.4 139 C57.8 139 59 140.4 59 143.4 L59 145 C59 146.4 58.2 147 57 147 L49.4 147 C48.6 147 48 146.4 48 145 Z"
        fill="#2b2d34"
      />
      <path d="M50.2 140.8 Q53.5 139.8 57 140.8" fill="none" stroke="#4a4d56" strokeWidth={0.7} />
      <rect x={48} y={145.4} width={11} height={1.6} rx={0.8} fill="#e6e6e6" />
    </>
  )
}

// Braço esquerdo pendurado do ombro (45, 95): manga, antebraço a partir do cotovelo (45, 107) e a
// mão em (45, 121). O direito é este espelhado; nos dois, ângulo positivo levanta para fora.
function Arm({ side, hand, whip }: { side: 'l' | 'r'; hand: Hand; whip?: boolean }) {
  return (
    <Pivot x={45} y={95} pose={`m-arm-${side}`} move={`m-arm-${side}-move`}>
      <Pivot x={45} y={107} pose={`m-fore-${side}`} move={`m-fore-${side}-move`}>
        {whip && (
          <>
            <rect x={43.5} y={121} width={3} height={11} rx={1.5} fill="#4a2c17" />
            <path d="M44.4 123 L44.4 131" stroke="#7a4b2a" strokeWidth={0.6} strokeLinecap="round" />
          </>
        )}
        <path d="M42.4 105 L47.6 105 L47.2 118.2 C46.6 119.4 43.4 119.4 42.8 118.2 Z" fill="url(#mascot-limb)" />
        <path d="M43.2 107.5 L43.5 117.5" stroke="#cf9576" strokeWidth={0.8} strokeLinecap="round" opacity={0.45} />
        <HandShape kind={hand} />
      </Pivot>
      <path d="M40.8 93.6 C42.2 91.2 47.8 91.2 49.2 93.6 L49.6 105.8 C47 107.2 43 107.2 40.4 105.8 Z" fill="url(#mascot-sleeve)" />
      <path d="M40.6 105.2 C43.2 106.6 46.8 106.6 49.4 105.2" fill="none" stroke="#c08c10" strokeWidth={1.1} strokeLinecap="round" />
    </Pivot>
  )
}

// Mão com o centro em (45, 121), dedos para baixo (para longe do cotovelo); o polegar fica do lado
// de dentro. Na joia, o polegar sai na ponta: com o antebraço para cima, aponta para cima.
function HandShape({ kind }: { kind: Hand }) {
  if (kind === 'open') {
    return (
      <>
        <path d="M41.8 117.8 C41 121 41.8 125.2 45 125.6 C48.2 125.2 49 121 48.2 117.8 Z" fill="url(#mascot-limb)" />
        <ellipse cx={48.3} cy={119.8} rx={1.3} ry={2.6} fill="#e8b493" transform="rotate(-25 48.3 119.8)" />
        <path d="M43.8 122.8 L44 124.8 M46.1 122.8 L46 124.8" stroke="#cf9576" strokeWidth={0.5} strokeLinecap="round" opacity={0.5} />
      </>
    )
  }
  return (
    <>
      {kind === 'thumb' && (
        <>
          <rect x={43.6} y={122.4} width={2.8} height={7} rx={1.4} fill="#e8b493" />
          <ellipse cx={45} cy={128.4} rx={0.9} ry={0.75} fill="#f5d3c2" />
        </>
      )}
      <path d="M42 118 C41.6 121.3 42.8 124.2 45 124.2 C47.2 124.2 48.4 121.3 48 118 Z" fill="url(#mascot-limb)" />
      <path d="M42.8 121.2 C43.8 121.7 46.2 121.7 47.2 121.2" fill="none" stroke="#cf9576" strokeWidth={0.6} strokeLinecap="round" />
      {kind === 'fist' && <ellipse cx={47.2} cy={119.6} rx={1.2} ry={2} fill="#e8b493" transform="rotate(-30 47.2 119.6)" />}
    </>
  )
}

// ---------- de perfil (andando) ----------
// Virado para a direita; andando para a esquerda, o quadro inteiro espelha. A perna e o braço do
// lado de lá ficam atrás e mais escuros (.m-far). Ombro em (60, 95), cotovelo (60, 107), quadril (60, 121).

// Crânio fundo (atrás em x 25, testa em 89.6): de perfil a cabeça fica tão grande quanto de frente.
// Embaixo, atrás, o crânio fecha e a nuca entra e desce reta até a gola.
const SIDE_FACE =
  'M51.6 94 L50.6 86 C49.8 81.6 47.6 79 43.4 77.4 C33 73.4 25 66 25 52 C25 26 41 10.5 61 10.5 C78.5 10.5 89.2 22 89.6 37.5 C89.8 42 89.4 45.2 89 47.6 ' +
  'L94.4 59.4 C95.3 61.3 94.3 63.4 92 63.6 L90.2 63.9 C90.4 65.6 90.6 67.2 90.8 68.8 C91.2 70.4 90.7 71.9 89.9 72.5 ' +
  'C90.5 73.5 90.4 74.9 89.7 75.9 C89.6 77 89.9 78.2 90 79.4 C90 85.2 86.6 89.4 80.8 90.8 C74 92.4 63.5 91.6 56 90.4 Z'
const SIDE_HAIR =
  'M87.6 27 C90.6 21 90 13.4 84 9 C77 4.2 68 4.4 60 5.2 C41 6 23.6 18 23 42 C22.7 55.5 26 68 36.4 76.4 ' +
  'C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 79 30.6 87.6 27 Z'
const SIDE_BEARD =
  'M60.6 46 C59.6 55 60.6 65 64 75 C67 83.6 72.4 89.6 80.4 90.6 C86 89.8 89.4 85 89.6 78.6 C88.2 78 87 77 86.4 75.6 ' +
  'C84.2 77.6 80 77.6 76.2 74.6 C71.6 70.6 68.6 64.4 66.6 57.4 C65.6 53.4 65 49.6 64.6 46 Z'
const SIDE_EYE_WHITE = 'M77 49.9 C78.4 47.6 81.6 47.3 83.2 49.4 C81.8 51.3 78.8 51.6 77 49.9 Z'
const SIDE_SHIRT =
  'M52.4 92 C55.6 89.4 63.4 89 67.8 91.6 C70.8 93.4 71.8 97.4 71.6 101.4 C71.4 107 70.8 112.6 70.2 118 L69.9 123.6 ' +
  'C69.8 125.2 68.9 126 67.7 126 L52.6 126 C51.4 126 50.6 125.2 50.5 123.8 L50 118 C49.4 112 48.9 106 48.8 100.4 ' +
  'C48.7 96.2 49.8 93.4 52.4 92 Z'

function SideView() {
  return (
    <>
      <g className="m-far">
        <SideArm side="far" />
        <Pivot x={60} y={121} move="m-leg-far-move">
          <SideLeg />
        </Pivot>
      </g>
      <path d="M50.6 118 L69.6 118 L69.8 126.8 C66 128.4 62.6 129 59.4 129 C56 129 53 128.4 50.4 127.6 Z" fill="url(#mascot-jeans)" />
      <Pivot x={60} y={121} move="m-leg-near-move">
        <SideLeg />
      </Pivot>
      <path d={SIDE_SHIRT} fill="url(#mascot-shirt)" />
      <ellipse cx={66} cy={97} rx={5} ry={3} fill="#000" opacity={0.12} />
      <path d="M60.5 90.4 C63 92.4 65.6 92.8 68 91.8" fill="none" stroke="#c9930f" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M50.8 123.4 L69.8 123.4" stroke="#b8860d" strokeWidth={1} opacity={0.5} />
      <Pivot x={60} y={90} move="m-head-move">
        <SideHead />
      </Pivot>
      <SideArm side="near" />
    </>
  )
}

function SideHead() {
  return (
    <>
      <path d={SIDE_FACE} fill="url(#mascot-skin)" />
      <path
        d="M36.4 76.4 C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 L61.6 41.6 C52.4 44.2 46.2 50.4 44.4 58.6 C43.4 64.6 42.6 71.8 41.2 78.4 Z"
        fill="url(#mascot-fade)"
      />
      <path d={SIDE_HAIR} fill="url(#mascot-hair)" />
      <g fill="none" stroke="#a98059" strokeWidth={1} strokeLinecap="round" opacity={0.6}>
        <path d="M84.6 24 C83 16.4 77 11 68.4 9" />
        <path d="M78.6 28.6 C74.6 20.6 66.6 15.4 56 13.4" />
        <path d="M70.6 31.6 C64.6 24.6 54.6 20 44 19.4" />
        <path d="M61 35 C53 30.2 42.6 28.4 33.4 30.6" />
      </g>
      <path d="M50 9 Q64 5 79 8.4 Q66 9 54 12.6 Z" fill="#fff" opacity={0.12} />
      {/* Orelha */}
      <path
        d="M57.6 46.6 C53 44.6 49.4 47.8 49.6 53.4 C49.8 58.8 52.4 62.6 56.6 62.4 C58.6 62.2 59.2 60 58.4 57.8 C59.8 54 59.6 49 57.6 46.6 Z"
        fill="url(#mascot-skin)"
        stroke="#c99274"
        strokeWidth={0.6}
      />
      <g fill="none" stroke="#c48a6b" strokeLinecap="round">
        <path d="M55.6 49.6 C52.8 50.2 52.4 54.6 54 57.6" strokeWidth={1.1} />
        <path d="M55 52.4 C56.2 53 56.4 54.8 55.4 55.8" strokeWidth={0.9} />
      </g>
      <ellipse cx={78} cy={59} rx={4.5} ry={2.6} fill="#e88f78" opacity={0.16} />
      <path
        d="M75 41.6 C78.4 39.6 83 39.4 86.4 40.8 C87 41.6 86.6 42.6 85.8 42.7 C82.6 42 78.8 42.4 75.8 43.8 C75 44.2 74.4 42.4 75 41.6 Z"
        fill="#4e3423"
      />
      <Pivot x={80.2} y={49.6} move="m-blink">
        <path d={SIDE_EYE_WHITE} fill="#fbf6f1" />
        <g clipPath="url(#mascot-eye-side)">
          <circle cx={81.4} cy={49.5} r={2.1} fill="#7c8975" stroke="#4b5546" strokeWidth={0.6} />
          <circle cx={81.4} cy={49.5} r={1} fill="#17100b" />
          <circle cx={82} cy={48.8} r={0.5} fill="#fff" />
        </g>
        <g fill="none" strokeLinecap="round">
          <path d="M76.4 49.8 C78 46.8 82 46.5 83.8 49.2" stroke="#2e2018" strokeWidth={1.4} />
          <path d="M76.6 49.6 L75.2 48.7" stroke="#2e2018" strokeWidth={0.9} />
        </g>
      </Pivot>
      <path d="M77.6 46.6 C79.4 45.2 82 45.1 83.4 46.2" fill="none" stroke="#c08667" strokeWidth={0.8} strokeLinecap="round" opacity={0.7} />
      {/* Nariz: o contorno já está no rosto; aqui a narina e o brilho. */}
      <path d="M89.8 49.4 L93.2 58.4" stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.25} />
      <ellipse cx={90.4} cy={62.2} rx={1.5} ry={0.75} fill="#93593f" opacity={0.6} transform="rotate(-15 90.4 62.2)" />
      <path d={SIDE_BEARD} fill="url(#mascot-beard)" filter="url(#mascot-soft)" />
      <path d={SIDE_BEARD} fill="url(#mascot-beard-texture)" opacity={0.16} />
      <ellipse cx={86.6} cy={80.6} rx={2.6} ry={2.4} fill="#7a4f33" opacity={0.2} filter="url(#mascot-soft)" />
      <path
        d="M89.6 69 C90.6 70.2 90.8 71.6 89.8 72.5 C90.4 73.5 90.2 75 89.4 75.7 C88.2 75.5 87.3 74.4 87.1 73 C87.1 71.4 87.9 69.8 89.6 69 Z"
        fill="url(#mascot-lip)"
      />
      <path d="M89.6 72.6 C88.2 72.9 86.8 72.8 85.6 72.2" fill="none" stroke="#7a433c" strokeWidth={0.9} strokeLinecap="round" />
      <path d="M85.4 67.4 C87.4 67.2 89 67.6 90 68.6 C88.6 69.6 86.6 69.8 85.2 69 Z" fill="#7a5236" opacity={0.45} filter="url(#mascot-soft)" />
    </>
  )
}

// Braço de perfil: balança para a frente e para trás; o antebraço fica um pouco dobrado para a frente.
function SideArm({ side }: { side: 'near' | 'far' }) {
  return (
    <Pivot x={60} y={95} move={`m-arm-${side}-move`}>
      <Pivot x={60} y={107} pose={`m-fore-${side}`}>
        <path d="M57.4 105 L62.6 105 L62.2 118.2 C61.6 119.4 58.4 119.4 57.8 118.2 Z" fill="url(#mascot-limb)" />
        <path d="M57 117.8 C56.2 121 57 124.8 60 125.2 C63 124.8 63.8 121 63 117.8 Z" fill="url(#mascot-limb)" />
        <ellipse cx={62.6} cy={119.6} rx={1.1} ry={2.2} fill="#e8b493" transform="rotate(-20 62.6 119.6)" />
      </Pivot>
      <path d="M55.8 93.6 C57.2 91.2 62.8 91.2 64.2 93.6 L64.6 105.8 C62 107.2 58 107.2 55.4 105.8 Z" fill="url(#mascot-sleeve)" />
      <path d="M55.6 105.2 C58.2 106.6 61.8 106.6 64.4 105.2" fill="none" stroke="#c08c10" strokeWidth={1.1} strokeLinecap="round" />
    </Pivot>
  )
}

// Perna de perfil, com o bico do tênis para a frente.
function SideLeg() {
  return (
    <>
      <path d="M56.3 120 L63.7 120 L63.3 140.6 C63.2 142 62.5 142.8 61.3 142.8 L58.7 142.8 C57.5 142.8 56.8 142 56.7 140.6 Z" fill="url(#mascot-jeans)" />
      <path d="M58.2 124 L58.4 139" stroke="#45464e" strokeWidth={0.7} opacity={0.6} />
      <path
        d="M56 139 L62.6 139 C65.8 139 68.6 140.8 69.8 143.2 C70.4 144.8 69.6 147 67.8 147 L56.8 147 C55.8 147 55.2 146.2 55.2 145.2 L55.2 140.6 C55.2 139.6 55.6 139 56 139 Z"
        fill="#2b2d34"
      />
      <path d="M58 140.6 Q61.5 139.8 65 140.8" fill="none" stroke="#4a4d56" strokeWidth={0.7} />
      <rect x={55.2} y={145.4} width={14.8} height={1.6} rx={0.8} fill="#e6e6e6" />
    </>
  )
}

// ---------- chicote e extras ----------

function Lash({ d }: { d: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="#6f4322" strokeWidth={2.4} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#a8703f" strokeWidth={1} strokeLinecap="round" />
    </>
  )
}

// Estrela de `points` pontas em volta de (cx, cy).
function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const step = Math.PI / points
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const a = i * step - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  })
  return `M${corners.join(' L')} Z`
}

// Brilho de quatro pontas com os lados curvos.
function twinkle(cx: number, cy: number, s: number): string {
  return `M${cx} ${cy - s} Q${cx} ${cy} ${cx + s} ${cy} Q${cx} ${cy} ${cx} ${cy + s} Q${cx} ${cy} ${cx - s} ${cy} Q${cx} ${cy} ${cx} ${cy - s} Z`
}

const SPARK = star(LASH_TIP.x, LASH_TIP.y, 8, 3.2, 6)

// Estalo (tira reta até a pasta) e depois a tira caindo. A preparação fica atrás da cabeça.
function Strike() {
  return (
    <>
      <g className="m-lash-crack">
        <Lash d="M112 95 C126 86 140 102 154 94 C165 88 174 98 184 93" />
      </g>
      <g className="m-lash-follow">
        <Lash d="M100.3 121.9 C110 132 126 124 139 134 C150 142 162 140 175 146" />
      </g>
      <Pivot x={LASH_TIP.x} y={LASH_TIP.y} move="m-spark">
        <path d={SPARK} fill="#ffd84a" stroke="#ff9a3c" strokeWidth={0.8} strokeLinejoin="round" />
        <g stroke="#ffd84a" strokeWidth={1.2} strokeLinecap="round">
          <path d="M195.5 85 L197.5 83" />
          <path d="M196.5 101 L198.5 103" />
          <path d="M186.5 81.5 L186.5 79" />
        </g>
      </Pivot>
    </>
  )
}

// Aviso de pendência, acima do ombro do braço que acena.
function Badge() {
  return (
    <Pivot x={106} y={24} move="m-badge">
      <circle cx={106} cy={24} r={7} fill="#ff453a" stroke="#fff" strokeWidth={1.4} />
      <rect x={105} y={19.4} width={2} height={5.6} rx={1} fill="#fff" />
      <circle cx={106} cy={27.9} r={1.1} fill="#fff" />
    </Pivot>
  )
}

const SPARKLES = [
  { x: 104, y: 70, s: 4 },
  { x: 100, y: 60, s: 2.8 },
  { x: 108, y: 81, s: 2.4 }
]

function Sparkles() {
  return SPARKLES.map((p, i) => (
    <Pivot key={i} x={p.x} y={p.y} move={`m-sparkle m-sparkle-${i}`}>
      <path d={twinkle(p.x, p.y, p.s)} fill="#ffd84a" />
    </Pivot>
  ))
}

// Ondas entrando na orelha (a mão em concha está logo abaixo).
const EAR = { x: 101, y: 66 }

function arc(r: number): string {
  const a = Math.PI / 4
  const x = (EAR.x + r * Math.cos(a)).toFixed(2)
  return `M${x} ${(EAR.y - r * Math.sin(a)).toFixed(2)} A${r} ${r} 0 0 1 ${x} ${(EAR.y + r * Math.sin(a)).toFixed(2)}`
}

function SoundWaves() {
  return [5, 9, 13].map((r, i) => (
    <Pivot key={r} x={EAR.x} y={EAR.y} move={`m-sound m-sound-${i}`}>
      <path d={arc(r)} fill="none" stroke="#7cc4ff" strokeWidth={1.8} strokeLinecap="round" />
    </Pivot>
  ))
}
