import { createContext, memo, useContext, useId, type CSSProperties, type ReactNode } from 'react'
import {
  beardPalette,
  bodyShape,
  clothPalette,
  COVERS_EARS,
  eyePalette,
  hairPalette,
  mix,
  skinPalette,
  sleevePalette,
  STRIKES,
  type BeardStyle,
  type BuildShape,
  type Accessory,
  type ClothPalette,
  type EyeShape,
  type FaceShape,
  type HairPalette,
  type HairStyle,
  type MascotLook,
  type MeleeStrike,
  type SkinPalette,
  type Strike
} from './look'

// Desenho do mascote em vetor: cabeça grande e corpo pequeno, camiseta amarela e calça preta. Corpo,
// cabelo, rosto, olhos, boca, pele e barba vêm do visual escolhido (look.ts); o padrão é o original: magro,
// cabelo curto castanho-claro com as laterais mais baixas, sobrancelha grossa, olhos
// verde-acinzentados e barba rala.
// Cada parte que mexe fica num Pivot (ombro, cotovelo, pescoço, quadril, pés); as poses e as
// animações estão em styles/mascot.css, pela classe pose-* do <svg>.

// ask: pergunta esperando você. wave: acenando com o aviso de erro. thumbs: pronto, com o check
// verde. think, type e search: trabalhando (pensando, digitando no notebook, procurando com a lupa).
export type Pose = 'idle' | 'walk' | 'dance' | 'listen' | 'thumbs' | 'wave' | 'ask' | 'think' | 'type' | 'search' | Strike

export const isStrike = (pose: Pose): pose is Strike => pose in STRIKES

// Área do desenho, em unidades do viewBox. O boneco ocupa x 20-100 e y 5-147; à direita sobra
// espaço para o chicote e, em cima, para a tira na preparação.
export const VIEW = { x: 0, y: -12, w: 200, h: 172 }
// Eixo do corpo (para virar de lado) e canto esquerdo do boneco.
export const BODY_X = 60
export const LEFT_EDGE = 20

// A cabeça no corpo, em volta do pescoço (60, 90): 80% do desenho dela, para ficar mais
// proporcional ao corpo. As miniaturas de rosto, cabelo e olhos mostram a cabeça no tamanho todo.
const HEAD_SCALE = 0.8
const NECK = { x: 60, y: 90 }
const headTransform = (narrow: number) =>
  `matrix(${narrow * HEAD_SCALE} 0 0 ${HEAD_SCALE} ${NECK.x * (1 - narrow * HEAD_SCALE)} ${NECK.y * (1 - HEAD_SCALE)})`
// Um ponto da cabeça (no desenho dela) onde fica no corpo.
const onHead = (x: number, y: number) => ({ x: NECK.x + (x - NECK.x) * HEAD_SCALE, y: NECK.y + (y - NECK.y) * HEAD_SCALE })

// O lado direito é o esquerdo espelhado no eixo do corpo.
const MIRROR = `matrix(-1 0 0 1 ${BODY_X * 2} 0)`

// Alarga (k > 1) em volta da linha vertical x = cx.
const widen = (cx: number, k: number) => (k === 1 ? undefined : `matrix(${k} 0 0 1 ${cx * (1 - k)} 0)`)
const shift = (dx: number) => (dx === 0 ? undefined : `translate(${dx} 0)`)

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

export type Mouth = 'calm' | 'smile' | 'grin'
type Hand = 'open' | 'fist' | 'thumb'

// O visual e as cores dele, para as partes do desenho. `url` dá a referência de um gradiente ou
// recorte deste desenho: o preview das configurações abre outro mascote na mesma janela, e cada
// um precisa dos próprios ids.
type Figure = {
  look: MascotLook
  hair: HairPalette
  beard: HairPalette
  skin: SkinPalette
  build: BuildShape
  female: boolean
  // Roupa: a parte de cima (e a manga), a de baixo e a camiseta branca por baixo da jaqueta.
  top: ClothPalette
  sleeve: { mid: string; edge: string; cuff: string }
  bottom: ClothPalette
  inner: ClothPalette
  url: (name: string) => string
}
const FigureContext = createContext<Figure | null>(null)
const useFigure = () => useContext(FigureContext)!

function FigureProvider({ look, children }: { look: MascotLook; children: (id: string) => ReactNode }) {
  const id = `mascot${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const figure: Figure = {
    look,
    hair: hairPalette(look.hairColor),
    beard: beardPalette(look),
    skin: skinPalette(look.skin),
    build: bodyShape(look),
    female: look.sex === 'female',
    top: clothPalette(look.topColor),
    sleeve: sleevePalette(look.topColor),
    bottom: clothPalette(look.bottomColor),
    inner: clothPalette('white'),
    url: (name) => `url(#${id}-${name})`
  }
  return <FigureContext.Provider value={figure}>{children(id)}</FigureContext.Provider>
}

export type View = { x: number; y: number; w: number; h: number }
const viewBox = (v: View) => `${v.x} ${v.y} ${v.w} ${v.h}`

// view: o pedaço do desenho que aparece (padrão: o quadro da janela do mascote, com o espaço do
// chicote).
// still: parado, sem animação nenhuma (miniaturas do editor); num golpe, fica no impacto.
export const MascotFigure = memo(function MascotFigure({
  pose,
  look,
  view = VIEW,
  still
}: {
  pose: Pose
  look: MascotLook
  view?: View
  still?: boolean
}) {
  // Andando e no hadouken, de perfil.
  const side = pose === 'walk' || pose === 'hadouken'
  return (
    <FigureProvider look={look}>
      {(id) => (
        <svg
          viewBox={viewBox(view)}
          width="100%"
          height="100%"
          className={`mascot pose-${pose}${still ? ' mascot-still' : ''}`}
          style={{ '--strike-ms': `${STRIKES[look.strike].ms}ms` } as CSSProperties}
        >
          <Defs id={id} />
          {/* Sombra no chão: fica parada quando ele pula. */}
          <ellipse cx={60} cy={148.5} rx={22} ry={3.4} fill="#000" opacity={0.22} />
          <Pivot x={60} y={147} move="m-body-move">
            {/* Trocar de frente para perfil remonta o grupo: a animação .m-turn faz o giro. */}
            <Pivot key={side ? 'side' : 'front'} x={60} y={147} move="m-turn">
              {side ? <SideView pose={pose} /> : <FrontView pose={pose} />}
            </Pivot>
          </Pivot>
          {/* A bola do hadouken voa solta, fora do corpo: não inclina junto com ele. */}
          {pose === 'hadouken' && <Fireball />}
        </svg>
      )}
    </FigureProvider>
  )
})

// Só a cabeça, de frente e parada, no pedaço `view` (as miniaturas de cabelo, rosto, olhos e barba).
// mouth: a expressão (as miniaturas de boca mostram a de repouso, que é o estilo em si).
export const MascotHead = memo(function MascotHead({ look, view, mouth = 'smile' }: { look: MascotLook; view: View; mouth?: Mouth }) {
  return (
    <FigureProvider look={look}>
      {(id) => (
        <svg viewBox={viewBox(view)} width="100%" height="100%" className="mascot mascot-still">
          <Defs id={id} />
          <Head mouth={mouth} />
        </svg>
      )}
    </FigureProvider>
  )
})

// De frente: todas as poses menos andar.
function FrontView({ pose }: { pose: Pose }) {
  const { url, build, look } = useFigure()
  const strike = isStrike(pose) ? pose : null
  const melee = strike === 'slap' || strike === 'punch' || strike === 'kick' ? strike : null
  const mouth: Mouth = strike || pose === 'dance' || pose === 'thumbs' ? 'grin' : pose === 'search' || pose === 'type' ? 'smile' : 'calm'
  const rightHand: Hand =
    pose === 'whip' || pose === 'punch' || pose === 'think' || pose === 'search' ? 'fist' : pose === 'thumbs' ? 'thumb' : 'open'
  const skirt = look.bottom === 'skirt'
  // Os efeitos do golpe acompanham a mão (ou o pé, no chute) quando o corpo é mais largo.
  const fx = shift(strike === 'kick' ? build.hip : build.shoulder)
  const leg = (side: 'l' | 'r') => (
    <g transform={shift(-build.hip)}>
      <Pivot x={53.5} y={121} move={`m-leg-${side}-move`}>
        <g transform={widen(53.5, build.leg)}>
          <Leg />
        </g>
      </Pivot>
    </g>
  )
  return (
    <>
      {pose === 'whip' && (
        <g className="m-lash-windup" transform={fx}>
          <Lash d="M92.7 63.8 C100 40 96 6 76 -3 C58 -10 38 -6 28 6 C24 11 22 18 22 24" />
        </g>
      )}
      {melee && (
        <g transform={fx}>
          <Swoosh strike={melee} />
        </g>
      )}
      {!skirt && (
        <g transform={widen(60, build.torso)}>
          <Hips />
        </g>
      )}
      {leg('l')}
      <g transform={MIRROR}>{leg('r')}</g>
      {skirt && (
        <g transform={widen(60, build.torso)}>
          <Skirt />
        </g>
      )}
      <Pivot x={60} y={124} move="m-torso-move">
        <g transform={widen(60, build.torso)}>
          <Torso />
        </g>
        {look.accessories.includes('necklace') && <Necklace />}
      </Pivot>
      <Pivot x={60} y={90} pose="m-head" move="m-head-move">
        {/* Cabeça menor que o desenho (HEAD_SCALE) e 3% mais estreita, em volta do pescoço. */}
        <g transform={headTransform(0.97)}>
          <Head mouth={mouth} />
        </g>
      </Pivot>
      {pose === 'type' && <Laptop />}
      <Arm side="l" hand={pose === 'punch' ? 'fist' : 'open'} item={pose === 'punch' ? 'glove' : undefined} />
      <g transform={MIRROR}>
        <Arm side="r" hand={rightHand} item={pose === 'whip' ? 'whip' : pose === 'punch' ? 'glove' : pose === 'search' ? 'lens' : undefined} />
      </g>
      {(pose === 'whip' || melee) && <g transform={fx}>{melee ? <Impact strike={melee} /> : <WhipCrack />}</g>}
      {pose === 'wave' && <WarningBadge />}
      {pose === 'ask' && <QuestionBadge />}
      {pose === 'thumbs' && (
        <>
          <Sparkles />
          <CheckBadge />
        </>
      )}
      {pose === 'think' && <ThoughtBubble />}
      {pose === 'type' && <CodeBits />}
      {pose === 'listen' && <SoundWaves />}
    </>
  )
}

function Defs({ id }: { id: string }) {
  const { look, hair, beard, skin, top, sleeve, bottom, inner, female, build } = useFigure()
  const eye = EYES[look.eyes]
  return (
    <defs>
      <radialGradient id={`${id}-skin`} cx={54} cy={46} r={46} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor={skin.skin[0]} />
        <stop offset={0.55} stopColor={skin.skin[1]} />
        <stop offset={1} stopColor={skin.skin[2]} />
      </radialGradient>
      <linearGradient id={`${id}-limb`} x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor={skin.limb[0]} />
        <stop offset={0.45} stopColor={skin.limb[1]} />
        <stop offset={1} stopColor={skin.limb[2]} />
      </linearGradient>
      {/* Um degradê só para o cabelo todo (frente, trás, cachos), para as partes emendarem sem
          mudar de tom. Do alto da cabeça até a têmpora; abaixo disso, a cor de baixo. */}
      <linearGradient id={`${id}-hair`} x1={0} x2={0} y1={2} y2={42} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor={hair.top} />
        <stop offset={1} stopColor={hair.bottom} />
      </linearGradient>
      <linearGradient id={`${id}-fade`} x1={0} x2={0} y1={0} y2={1}>
        <stop offset={0} stopColor={hair.bottom} stopOpacity={0.85} />
        <stop offset={1} stopColor={hair.bottom} stopOpacity={0.1} />
      </linearGradient>
      {/* Barba rala: quase some na bochecha, aparece mais no queixo. A cheia é a mesma, mais forte. */}
      <linearGradient id={`${id}-beard`} x1={0} x2={0} y1={50} y2={92} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor={beard.beard} stopOpacity={0.06} />
        <stop offset={0.45} stopColor={beard.beard} stopOpacity={0.2} />
        <stop offset={1} stopColor={beard.beard} stopOpacity={0.36} />
      </linearGradient>
      <linearGradient id={`${id}-beard-full`} x1={0} x2={0} y1={44} y2={92} gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor={beard.beard} stopOpacity={0.45} />
        <stop offset={0.4} stopColor={beard.beard} stopOpacity={0.8} />
        <stop offset={1} stopColor={beard.beard} stopOpacity={0.95} />
      </linearGradient>
      {/* Borda esfumada: sem ela a barba parece uma máscara. */}
      <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={1.3} />
      </filter>
      <pattern id={`${id}-beard-texture`} width={2.2} height={2.2} patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <path d="M0.5 0.2 L0.9 1.4" stroke={beard.brow} strokeWidth={0.4} strokeLinecap="round" />
        <path d="M1.6 1 L1.9 2" stroke={beard.strand} strokeWidth={0.4} strokeLinecap="round" />
      </pattern>
      <linearGradient id={`${id}-lip`} x1={0} x2={0} y1={0} y2={1}>
        <stop offset={0} stopColor={skin.lip[0]} />
        <stop offset={1} stopColor={skin.lip[1]} />
      </linearGradient>
      {/* Roupa: a parte de cima (shirt, sleeve), a de baixo (jeans, o nome de quando era sempre
          calça) e a camiseta por baixo da jaqueta (inner). */}
      {(
        [
          ['shirt', top, 0.5],
          ['sleeve', sleeve, 0.55],
          ['jeans', bottom, 0.5],
          ['inner', inner, 0.5]
        ] as const
      ).map(([name, c, middle]) => (
        <linearGradient key={name} id={`${id}-${name}`} x1={0} x2={1} y1={0} y2={0}>
          <stop offset={0} stopColor={c.edge} />
          <stop offset={middle} stopColor={c.mid} />
          <stop offset={1} stopColor={c.edge} />
        </linearGradient>
      ))}
      {/* O tronco (mais a barriga): a regata e a jaqueta ficam recortadas nele. */}
      <clipPath id={`${id}-torso`}>
        <path d={female ? TORSO_FEMALE : TORSO_MALE} />
        {build.belly && <ellipse {...BELLY} />}
      </clipPath>
      <clipPath id={`${id}-side-torso`}>
        <path d={female ? SIDE_SHIRT_FEMALE : SIDE_SHIRT_MALE} />
        {build.belly && <ellipse {...SIDE_BELLY} />}
      </clipPath>
      <linearGradient id={`${id}-glove`} x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#b3261e" />
        <stop offset={0.5} stopColor="#ef4f43" />
        <stop offset={1} stopColor="#b3261e" />
      </linearGradient>
      {/* Bola de energia do hadouken: miolo branco, azul em volta, sumindo na borda; o rastro some
          para trás. */}
      <radialGradient id={`${id}-energy`}>
        <stop offset={0} stopColor="#ffffff" />
        <stop offset={0.35} stopColor="#c8f4ff" />
        <stop offset={0.65} stopColor="#4cc2ff" stopOpacity={0.9} />
        <stop offset={1} stopColor="#2a6dff" stopOpacity={0} />
      </radialGradient>
      <linearGradient id={`${id}-energy-trail`} x1={0} x2={1} y1={0} y2={0}>
        <stop offset={0} stopColor="#2a6dff" stopOpacity={0} />
        <stop offset={1} stopColor="#7fd8ff" stopOpacity={0.85} />
      </linearGradient>
      {/* A barba fica dentro do rosto, seja qual for o formato. */}
      <clipPath id={`${id}-face`}>
        <path d={FACES[look.face]} />
      </clipPath>
      {/* Da altura da orelha para baixo: a barba de contorno só acompanha a mandíbula. */}
      <clipPath id={`${id}-jaw`}>
        <rect x={0} y={52} width={120} height={60} />
      </clipPath>
      {/* A íris fica cortada pelas pálpebras. */}
      <clipPath id={`${id}-eye-l`}>
        <path d={eye.white} />
      </clipPath>
      <clipPath id={`${id}-eye-r`}>
        <path d={eye.white} transform="scale(-1 1)" />
      </clipPath>
      <clipPath id={`${id}-eye-side`}>
        <path d={SIDE_EYE_WHITE} />
      </clipPath>
    </defs>
  )
}

// ---------- cabeça ----------

// Formatos de rosto, todos com o topo da cabeça perto de y 12 e o queixo perto de y 90. O oval é o
// original: a bochecha afina desde a altura dos olhos até o queixo.
const FACES: Record<FaceShape, string> = {
  oval:
    'M30 38 C30 21 42.5 12.5 60 12.5 C77.5 12.5 90 21 90 38 C90 46 89.9 55 88.9 62 C87 75 76 90.6 60 90.6 ' +
    'C44 90.6 33 75 31.1 62 C30.1 55 30 46 30 38 Z',
  round:
    'M29.4 38 C29.4 21 42.2 12.5 60 12.5 C77.8 12.5 90.6 21 90.6 38 C90.6 50 91 59 89.6 66.6 C87.4 79.6 75.6 89.4 60 89.4 ' +
    'C44.4 89.4 32.6 79.6 30.4 66.6 C29 59 29.4 50 29.4 38 Z',
  square:
    'M30 38 C30 21 42.5 12.5 60 12.5 C77.5 12.5 90 21 90 38 C90 49 90.2 59 89.2 67.6 C88.4 75 85 81.6 78.4 85.4 ' +
    'C73 88.6 67 90 60 90 C53 90 47 88.6 41.6 85.4 C35 81.6 31.6 75 30.8 67.6 C29.8 59 30 49 30 38 Z',
  long:
    'M31.6 37 C31.6 20 43.6 11.8 60 11.8 C76.4 11.8 88.4 20 88.4 37 C88.4 47 88.2 56 87.2 64 C85.4 78 75.4 92.2 60 92.2 ' +
    'C44.6 92.2 34.6 78 32.8 64 C31.8 56 31.6 47 31.6 37 Z',
  heart:
    'M29.6 37 C29.6 20.6 42.2 12.3 60 12.3 C77.8 12.3 90.4 20.6 90.4 37 C90.4 45.6 89.4 53 87.4 60.4 C84.4 72 72.6 91 60 91 ' +
    'C47.4 91 35.6 72 32.6 60.4 C30.6 53 29.6 45.6 29.6 37 Z',
  // Testa e queixo estreitos, o mais largo nas maçãs do rosto (y 56).
  diamond:
    'M33 36 C33 20 44 12.5 60 12.5 C76 12.5 87 20 87 36 C89 44 91 50 90.6 56 C89.6 66 84 76 76 83.6 C71 88.4 65.6 91 60 91 ' +
    'C54.4 91 49 88.4 44 83.6 C36 76 30.4 66 29.4 56 C29 50 31 44 33 36 Z',
  // Testa estreita e mandíbula larga.
  triangle:
    'M33.4 38 C33.4 21 44.6 12.5 60 12.5 C75.4 12.5 86.6 21 86.6 38 C87.8 47 90.4 56 91 64 C91.6 73 87.4 81 80 85.8 ' +
    'C74.6 89.4 67.6 90.6 60 90.6 C52.4 90.6 45.4 89.4 40 85.8 C32.6 81 28.4 73 29 64 C29.6 56 32.2 47 33.4 38 Z',
  // Bochechas cheias, saindo para os lados abaixo dos olhos.
  chubby:
    'M30 38 C30 21 42.5 12.5 60 12.5 C77.5 12.5 90 21 90 38 C90 46 91.6 54 92.4 62 C93.4 72 88 82 79.6 87 C74 90.2 67 91 60 91 ' +
    'C53 91 46 90.2 40.4 87 C32 82 26.6 72 27.6 62 C28.4 54 30 46 30 38 Z',
  // Mandíbula reta e queixo marcado, com a covinha no meio (FACE_DETAIL).
  chin:
    'M30 38 C30 21 42.5 12.5 60 12.5 C77.5 12.5 90 21 90 38 C90 48 90 58 88.6 66 C87.4 73 83.6 79 78 83 C74 86 70 87.4 67 89 ' +
    'C65 90.6 62.6 91.6 60 91.6 C57.4 91.6 55 90.6 53 89 C50 87.4 46 86 42 83 C36.4 79 32.6 73 31.4 66 C30 58 30 48 30 38 Z',
  // Mais largo e mais curto.
  wide:
    'M28 40 C28 22 41.6 13 60 13 C78.4 13 92 22 92 40 C92 50 91.6 59 90 66 C87.6 77 76 88 60 88 C44 88 32.4 77 30 66 ' +
    'C28.4 59 28 50 28 40 Z',
  // Afinando até um queixo pequeno e pontudo.
  vshape:
    'M30.4 37 C30.4 20.6 42.6 12.4 60 12.4 C77.4 12.4 89.6 20.6 89.6 37 C89.6 46 89 54 87.4 61 C84.6 72 74 86 64 90.6 ' +
    'C62.6 91.3 61.3 91.6 60 91.6 C58.7 91.6 57.4 91.3 56 90.6 C46 86 35.4 72 32.6 61 C31 54 30.4 46 30.4 37 Z',
  // Testa estreita, o mais largo embaixo, nas bochechas, e o queixo redondo.
  pear:
    'M33.4 38 C33.4 21 44.6 12.5 60 12.5 C75.4 12.5 86.6 21 86.6 38 C88 46 91.4 54 92 63 C92.6 74 85 84.6 74 88.6 ' +
    'C69.6 90.2 64.8 90.8 60 90.8 C55.2 90.8 50.4 90.2 46 88.6 C35 84.6 27.4 74 28 63 C28.6 54 32 46 33.4 38 Z',
  // Comprido, com a mandíbula reta.
  rectangle:
    'M31 36 C31 20 43 11.6 60 11.6 C77 11.6 89 20 89 36 C89 48 89.2 60 88.4 69 C87.6 77 84.4 84 78.4 88 C73.4 91.2 67 92.4 60 92.4 ' +
    'C53 92.4 46.6 91.2 41.6 88 C35.6 84 32.4 77 31.6 69 C30.8 60 31 48 31 36 Z',
  // Bem redondo e baixo, com o queixo pequeno.
  baby:
    'M28.6 40 C28.6 22 41.6 13.4 60 13.4 C78.4 13.4 91.4 22 91.4 40 C91.4 52 92 62 89.6 70.6 C86.4 81.8 74.6 88.6 60 88.6 ' +
    'C45.4 88.6 33.6 81.8 30.4 70.6 C28 62 28.6 52 28.6 40 Z',
  // Maçãs do rosto altas e a mandíbula marcada, em ângulo (os traços das maçãs em FACE_DETAIL).
  angular:
    'M30.4 37 C30.4 20.6 42.6 12.4 60 12.4 C77.4 12.4 89.6 20.6 89.6 37 C90.4 46 91 52 90 58 C89 66 86.4 72 82.4 78 ' +
    'C78.6 83.6 73 87.6 66.6 90.2 C64.4 91 62.2 91.4 60 91.4 C57.8 91.4 55.6 91 53.4 90.2 C47 87.6 41.4 83.6 37.6 78 ' +
    'C33.6 72 31 66 30 58 C29 52 29.6 46 30.4 37 Z'
}

// Traço a mais de alguns rostos (a covinha do queixo marcado, as maçãs do anguloso).
const FACE_DETAIL: Partial<Record<FaceShape, string>> = {
  chin: 'M60 86.2 C59.6 87.6 59.7 88.8 60.2 89.8',
  angular: 'M34.6 61 C36.4 65 38.6 67.6 41.6 69.6 M85.4 61 C83.6 65 81.4 67.6 78.4 69.6'
}

// Cabelo. back: atrás do rosto (o que desce ao lado dele, o rabo, o coque); backBumps: círculos do
// contorno que ficam atrás (black power); under: camada raspada, bem fina (laterais do moicano e do
// raspado dos lados); front: por cima da testa; opacity: do front (careca e máquina baixa deixam a
// pele aparecer); strands: mechas; shine: brilho; bumps: círculos (cachos) no contorno; curls:
// traços dos cachos; tie: elástico do coque; fade: laterais curtas, clareando até a orelha.
// locks: mechas grossas atrás do rosto (dreads); frontLocks: as que caem na testa; braid: os círculos
// de trás ganham contorno, como gomos de trança; ties: elásticos coloridos (maria-chiquinha, tranças).
type Circle = [number, number, number]
type HairArt = {
  back?: string
  backBumps?: Circle[]
  locks?: string[]
  braid?: boolean
  under?: string
  front?: string
  opacity?: number
  strands: string[]
  shine?: string
  bumps?: Circle[]
  curls?: [number, number][]
  frontLocks?: string[]
  tie?: string
  ties?: Circle[]
  fade?: boolean
}

// Elástico de cabelo colorido.
const TIE_COLOR = '#ef5a7a'

// Gomos de uma trança: círculos de (x, y0) até (x1, y1).
const braid = (x0: number, y0: number, x1: number, y1: number, count: number, r: number): Circle[] =>
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    return [+(x0 + (x1 - x0) * t).toFixed(2), +(y0 + (y1 - y0) * t).toFixed(2), r]
  })

// Bolinhas do cacho, em volta de (x, y).
const curl = ([x, y]: [number, number]) => `M${x - 2.4} ${y} a2.4 2.4 0 1 1 2.4 2.4`

// `count` círculos de raio r em volta da elipse (cx, cy, rx, ry): o contorno fofo do black power.
const ring = (cx: number, cy: number, rx: number, ry: number, r: number, count: number): Circle[] =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return [+(cx + rx * Math.cos(a)).toFixed(2), +(cy + ry * Math.sin(a)).toFixed(2), r]
  })

// Mechas do cabelo longo e do chanel, descendo ao lado do rosto.
const SIDE_LOCKS = (bottom: number) => [
  `M27 50 C26.4 ${50 + (bottom - 50) * 0.4} 26.4 ${50 + (bottom - 50) * 0.75} 27.6 ${bottom - 2}`,
  `M93 50 C93.6 ${50 + (bottom - 50) * 0.4} 93.6 ${50 + (bottom - 50) * 0.75} 92.4 ${bottom - 2}`
]

// Camada colada na cabeça: a máquina baixa, e a base raspada de outros cortes.
const BUZZ =
  'M29.2 40 C28 30 30.4 21.4 36 15.6 C42 9.6 50.6 7.4 60 7.4 C69.4 7.4 78 9.6 84 15.6 C89.6 21.4 92 30 90.8 40 ' +
  'L89.6 39.6 C89.2 33.6 88.4 29.6 86.8 27.4 C78.6 25.4 69.4 24.6 60 24.6 C50.6 24.6 41.4 25.4 33.2 27.4 ' +
  'C31.6 29.6 30.8 33.6 30.4 39.6 Z'
// Puxado para trás (coque, rabo de cavalo).
const PULLED =
  'M28.8 41.6 C27.6 30 30 21 36 15 C42 9 50.4 6.6 60 6.6 C69.6 6.6 78 9 84 15 C90 21 92.4 30 91.2 41.6 L89.8 41.2 ' +
  'C89.4 35 88.6 30.8 87 28.4 C79 26 70 25 60 25.2 C50 25.4 41 26 33 28.4 C31.4 30.8 30.6 35 30.2 41.2 Z'
const PULLED_STRANDS = [
  'M36 27 C38 18 46 11 55 8.6',
  'M46 25.6 C49 17 54 11 58.4 8.4',
  'M74 25.6 C71 17 66 11 61.6 8.4',
  'M84 27 C82 18 74 11 65 8.6'
]
const QUIFF_STRANDS = [
  'M35 26.4 C35.6 19.6 39.6 14.4 45 11',
  'M42 25.4 C43.6 17.6 48.6 11.6 55.6 8.2',
  'M50 24.4 C52 16.8 57.4 11.4 64.6 8.6',
  'M58 23.8 C60.4 17 66 12.4 73.4 10.4',
  'M66 23.8 C68.6 17.8 74.2 14 81 13.6',
  'M74 24.6 C76.6 19.6 81 17 86.4 17.8'
]
const SWEPT_FRINGE =
  'M27.6 44 C26.6 24 40 6.4 60 6.4 C80 6.4 93.4 24 92.4 44 L88.8 43 C88.4 37 87.6 33.6 86.2 31.6 C80 31.8 74 30.4 69 28 ' +
  'C63 30.6 54 32.6 44 32.4 C40 32.4 36.4 32 33.8 31.6 C32.4 33.6 31.6 37 31.2 43 Z'
const FRINGE_STRANDS = ['M36 30.6 C40 22 48 14 58 10', 'M48 31.6 C52 22 60 14 70 11', 'M70 28 C74 20 80 16 86 18']
const SHINE = 'M44 9.6 Q56 4.6 70 6.4 Q58 7.6 48 12.6 Z'
const SHINE_LOW = 'M46 11 Q58 7.6 72 10 Q59 10.4 49 13.6 Z'
const SHINE_LONG = 'M42 11 Q56 6.4 72 8.6 Q58 9.4 46 14 Z'

// Caminho ondulado de (x0, y0) até (x1, y1), sem o M (continua de onde o caminho está): `count`
// meias-ondas que saem `amp` para os lados, alternando (a primeira para +x).
const n2 = (v: number) => +v.toFixed(2)
function waves(x0: number, y0: number, x1: number, y1: number, amp: number, count: number): string {
  const at = (t: number) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
  let d = ''
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? -amp : amp
    const [xa, ya] = at((i + 1 / 3) / count)
    const [xb, yb] = at((i + 2 / 3) / count)
    const [xe, ye] = at((i + 1) / count)
    d += ` C${n2(xa + side)} ${n2(ya)} ${n2(xb + side)} ${n2(yb)} ${n2(xe)} ${n2(ye)}`
  }
  return d
}
// O lado esquerdo, de baixo para cima, espelhando as ondas do direito (que vai de cima para baixo).
const wavesUp = (x0: number, y0: number, x1: number, y1: number, amp: number, count: number) =>
  waves(x0, y0, x1, y1, count % 2 ? -amp : amp, count)
// Mecha ondulada solta.
const wavyStrand = (x0: number, y0: number, x1: number, y1: number, amp: number, count: number) => `M${x0} ${y0}${waves(x0, y0, x1, y1, amp, count)}`
// Alto da cabeça dos cabelos compridos, de orelha a orelha.
const LONG_TOP = 'M24.6 44 C23.4 24 38 5.6 60 5.6 C82 5.6 96.6 24 95.4 44'
// Repartido no meio (o longo liso e as ondas longas).
const MIDDLE_PART =
  'M27.6 46 C26.6 24 40 6.4 60 6.4 C80 6.4 93.4 24 92.4 46 L89.4 45.4 C89 37 87 30.4 82.6 26.4 C76.6 21.6 68 19.6 61.4 21 ' +
  'L60 24 L58.6 21 C52 19.6 43.4 21.6 37.4 26.4 C33 30.4 31 37 30.6 45.4 Z'
const MIDDLE_PART_STRANDS = ['M58.6 21.6 C50 22.4 41 26.6 35 34', 'M61.4 21.6 C70 22.4 79 26.6 85 34', 'M55 9 C46 11 38 16 33 24', 'M65 9 C74 11 82 16 87 24']

const CURLY: HairArt = {
  front:
    'M27 42 C23 32 24 18 33 10 C40 3.6 50 0.6 60 0.6 C70 0.6 80 3.6 87 10 C96 18 97 32 93 42 L89.8 41 ' +
    'C89.4 34 88.4 29.6 86.6 27 C78.4 24.8 69.2 23.8 60 24 C50.8 24.2 41.6 25 33.4 27 C31.6 29.6 30.6 34 30.2 41 Z',
  strands: [],
  bumps: [
    [28, 37, 5],
    [26.4, 27, 5.6],
    [30.6, 16.8, 6.2],
    [39.6, 8.6, 6.6],
    [51, 3.6, 6.8],
    [63.6, 2.8, 6.8],
    [75.6, 5.8, 6.6],
    [85.4, 12.6, 6.2],
    [91.8, 22.4, 5.6],
    [93.4, 33.4, 5],
    [35.6, 26.4, 3.4],
    [43.4, 25, 3.6],
    [51.6, 24.2, 3.6],
    [60, 24, 3.6],
    [68.4, 24.2, 3.6],
    [76.6, 25, 3.6],
    [84.4, 26.4, 3.4]
  ],
  curls: [
    [38, 17],
    [48, 11],
    [58, 8],
    [68, 9],
    [78, 13],
    [86, 20],
    [31, 30],
    [89, 31],
    [46, 19],
    [62, 16],
    [74, 19]
  ],
  fade: true
}

const HAIR_FRONT: Record<HairStyle, HairArt> = {
  // Curto e liso, penteado para cima e um pouco para o lado (topete leve à esquerda da testa);
  // contorno sem ondas. A linha da testa é limpa, com as entradas nas têmporas.
  quiff: {
    front:
      'M28.6 40 C27 30 29.4 20.4 35.6 14.2 C39.6 10.2 45 6 52 4.2 C58.4 2.8 66.8 3.6 74 5.8 C81 8 87.6 12.4 90.2 19.4 ' +
      'C92.4 25.6 92.6 33 91.4 40 L89.6 39.5 C89.2 33.5 88.4 29.4 86.8 27 C78.6 24.4 69.4 23.2 60 23.6 ' +
      'C50.6 24 41.4 25 33.2 27 C31.6 29.4 30.8 33.5 30.4 39.6 Z',
    strands: QUIFF_STRANDS,
    shine: SHINE,
    fade: true
  },
  // Máquina baixa: uma camada fina colada na cabeça.
  buzz: { front: BUZZ, opacity: 0.88, strands: [], shine: SHINE_LOW, fade: true },
  // Raspado total: só a sombra do cabelo e o brilho da cabeça.
  bald: { front: BUZZ, opacity: 0.14, strands: [], shine: 'M40 20 Q50 13.6 64 14.4 Q51 16.6 43 23 Z' },
  // Laterais raspadas e o volume em cima, penteado como o topete.
  undercut: {
    under: BUZZ,
    front:
      'M33.4 27.2 C31.4 19.6 34.6 12.4 41 8.4 C46 5.2 53 3.2 60.4 3.2 C68.4 3.2 75.6 5.2 80.6 8.6 C86.6 12.8 89.4 19.4 87.2 27.2 ' +
      'C78.8 24.6 69.4 23.4 60 23.6 C50.6 23.8 41.6 25 33.4 27.2 Z',
    strands: QUIFF_STRANDS.slice(1, 5),
    shine: SHINE
  },
  // Faixa alta no meio, laterais raspadas.
  mohawk: {
    under: BUZZ,
    front:
      'M51 25.6 C49.4 18 49.6 8 53 0 C55 -4.6 57.6 -7.6 60 -8.6 C62.4 -7.6 65 -4.6 67 0 C70.4 8 70.6 18 69 25.6 ' +
      'C66 24.9 63 24.6 60 24.6 C57 24.6 54 24.9 51 25.6 Z',
    strands: ['M55 22 C54 14 55 6 58 -2', 'M60 22 C60 12 60 4 60 -6', 'M65 22 C66 14 65 6 62 -2'],
    shine: 'M56.4 -1 Q60 -6.4 63.4 -1 Q60 -2.6 57.6 2 Z'
  },
  // Pontas para cima, com gel.
  spiky: {
    front:
      'M28.8 40 C27.4 32 28.6 24 32 18 L28 10 L37 13 L38 3 L45 9 L50 -1 L55 7 L61 -2 L65 7 L72 0 L74 9 L82 4 L82 13 L91 11 ' +
      'L88 19 C91.4 25 92.6 32 91.2 40 L89.6 39.5 C89.2 33.5 88.4 29.4 86.8 27 C78.6 24.4 69.4 23.2 60 23.6 ' +
      'C50.6 24 41.4 25 33.2 27 C31.6 29.4 30.8 33.5 30.4 39.6 Z',
    strands: ['M40 22 L36.6 11', 'M50 21 L48.6 5', 'M60 21 L60.8 3', 'M70 21 L71.6 6', 'M80 23 L82 11'],
    shine: SHINE,
    fade: true
  },
  // Social: liso, repartido à esquerda e penteado para a direita.
  sidePart: {
    front:
      'M28.6 40 C27.2 30 29 21 34.6 15.4 C40 10 48 7 58 6.6 C70 6.2 80 9 86 15 C90.6 20 92.4 30 91.4 40 L89.6 39.5 ' +
      'C89.2 33.5 88.4 29.4 86.8 27 C80 24.2 72 22.6 64 22.8 C56 23 48.6 24.4 42.6 26.2 L41.2 19.4 L39.4 26.8 ' +
      'C37 27.4 35 28 33.2 28.8 C31.6 31 30.8 34.5 30.4 39.6 Z',
    strands: [
      'M41.2 8.6 L41.2 19.4',
      'M42.4 18 C50 12 62 9.6 76 11',
      'M43 23 C52 17 65 14.4 81 16',
      'M45 26 C55 21 68 19.6 85 21.6',
      'M39.6 14 C35.4 17 32.6 22 31.6 30',
      'M40 22 C36.6 24 34 27 32.6 32'
    ],
    shine: 'M50 9.6 Q62 6.6 74 8.6 Q62 9.4 53 12.4 Z',
    fade: true
  },
  // Volume redondo de cachos, com uma fileira de cachinhos na testa.
  curly: CURLY,
  // Black power: uma bola grande de cachos em volta da cabeça.
  afro: {
    back: 'M23 28 A37 37 0 1 0 97 28 A37 37 0 1 0 23 28 Z',
    backBumps: ring(60, 28, 36, 36, 5.4, 20),
    front:
      'M30.4 40 C30.8 33.5 31.6 29.4 33.2 27 C41.4 25 50.6 24 60 23.6 C69.4 23.2 78.6 24.4 86.8 27 C88.4 29.4 89.2 33.5 89.6 40 ' +
      'L91.5 40 L91.5 10 L28.5 10 L28.5 40 Z',
    strands: [],
    curls: [
      [36, 0],
      [48, -4],
      [60, -5],
      [72, -4],
      [84, 0],
      [30, 14],
      [90, 14],
      [40, 12],
      [52, 8],
      [64, 8],
      [78, 12],
      [27, 30],
      [93, 30],
      [26, 46],
      [94, 46],
      [46, 18],
      [72, 18]
    ]
  },
  // Chanel: na altura do queixo, cobrindo as orelhas, com franja de lado.
  bob: {
    back:
      'M24.6 44 C23.4 24 38 5.6 60 5.6 C82 5.6 96.6 24 95.4 44 C95.6 58 96.4 72 97.2 82 C97.4 85.4 95.4 87.4 92.2 86.8 ' +
      'C88.6 86.2 85.6 85.6 82.6 84.8 L37.4 84.8 C34.4 85.6 31.4 86.2 27.8 86.8 C24.6 87.4 22.6 85.4 22.8 82 ' +
      'C23.6 72 24.4 58 24.6 44 Z',
    front: SWEPT_FRINGE,
    strands: [...FRINGE_STRANDS, ...SIDE_LOCKS(86)],
    shine: SHINE_LONG
  },
  // Ondulado até os ombros, com franja de lado.
  wavy: {
    back:
      'M24.6 44 C23.4 24 38 5.6 60 5.6 C82 5.6 96.6 24 95.4 44 C97 54 94 62 97 70 C100 78 96 86 98 94 C98.6 97 96.6 99 94 98.4 ' +
      'L84 96 C84 90 83 86 83 82 L37 82 C37 86 36 90 36 96 L26 98.4 C23.4 99 21.4 97 22 94 C24 86 20 78 23 70 ' +
      'C26 62 23 54 24.6 44 Z',
    front: SWEPT_FRINGE,
    strands: [
      ...FRINGE_STRANDS,
      'M26 50 C23 58 27 64 24 72 C22 80 26 86 25 94',
      'M94 50 C97 58 93 64 96 72 C98 80 94 86 95 94',
      'M31 84 C30 88 33 92 31 96',
      'M89 84 C90 88 87 92 89 96'
    ],
    shine: SHINE_LONG
  },
  // Chanel ondulado: na altura do queixo, as pontas em ondas, franja de lado.
  wavyBob: {
    back:
      `${LONG_TOP}${waves(95.4, 44, 97.4, 84, 2.6, 4)} C97.8 87 95.6 88.8 92.4 88.2 C88.8 87.6 85.8 87 82.8 86.2 L37.2 86.2 ` +
      `C34.2 87 31.2 87.6 27.6 88.2 C24.4 88.8 22.2 87 22.6 84${wavesUp(22.6, 84, 24.6, 44, 2.6, 4)} Z`,
    front: SWEPT_FRINGE,
    strands: [...FRINGE_STRANDS, wavyStrand(27, 50, 26.2, 84, 2, 4), wavyStrand(93, 50, 93.8, 84, -2, 4)],
    shine: SHINE_LONG
  },
  // Ondulado até os ombros, com franja cortininha abrindo para os lados.
  curtainWaves: {
    back:
      `${LONG_TOP}${waves(95.4, 44, 98, 95, 3, 5)} C98.4 98 96.4 99.6 93.6 99 L84 96.6 C84 90 83 86 83 82 L37 82 C37 86 36 90 36 96.6 ` +
      `L26.4 99 C23.6 99.6 21.6 98 22 95${wavesUp(22, 95, 24.6, 44, 3, 5)} Z`,
    front:
      'M27.6 46 C26.6 24 40 6.4 60 6.4 C80 6.4 93.4 24 92.4 46 L89.4 45.4 C89 37 86 31 80 28.4 C73.4 25.6 65.6 25.6 61.4 29.4 ' +
      'L60 26.6 L58.6 29.4 C54.4 25.6 46.6 25.6 40 28.4 C34 31 31 37 30.6 45.4 Z',
    strands: [
      'M58.6 28 C52.4 25.4 44.4 27.6 37.6 34',
      'M61.4 28 C67.6 25.4 75.6 27.6 82.4 34',
      'M55 9 C46 11 38 16 33 24',
      'M65 9 C74 11 82 16 87 24',
      wavyStrand(27, 50, 25.4, 94, 2.4, 5),
      wavyStrand(93, 50, 94.6, 94, -2.4, 5)
    ],
    shine: SHINE_LONG
  },
  // Ondas longas, repartidas no meio, descendo pelos ombros.
  beachWaves: {
    back:
      `${LONG_TOP}${waves(95.4, 44, 100, 106, 3.2, 6)} C100.4 109 98 111 95 110.6 L84.6 108.6${waves(84.6, 108.6, 83, 82, 2, 4)} ` +
      `L37 82${waves(37, 82, 35.4, 108.6, 2, 4)} L25 110.6 C22 111 19.6 109 20 106${wavesUp(20, 106, 24.6, 44, 3.2, 6)} Z`,
    front: MIDDLE_PART,
    strands: [
      ...MIDDLE_PART_STRANDS,
      wavyStrand(27, 50, 25.6, 104, 2.6, 6),
      wavyStrand(93, 50, 94.4, 104, -2.6, 6),
      wavyStrand(31.6, 86, 31, 107, 1.6, 3),
      wavyStrand(88.4, 86, 89, 107, -1.6, 3)
    ],
    shine: SHINE_LONG
  },
  // Cacheado longo e volumoso: os cachos do alto continuam pelos lados até abaixo dos ombros.
  longCurly: {
    ...CURLY,
    back:
      `M22 40 C20 18 38 2 60 2 C82 2 100 18 98 40${waves(98, 40, 102, 104, 4, 8)} C102 108 99 110 96 109.6 L85 107` +
      `${waves(85, 107, 83.4, 82, 2.4, 4)} L36.6 82${waves(36.6, 82, 35, 107, 2.4, 4)} L24 109.6 C21 110 18 108 18 104` +
      `${wavesUp(18, 104, 22, 40, 4, 8)} Z`,
    backBumps: [...braid(99, 46, 102, 102, 7, 5), ...braid(21, 46, 18, 102, 7, 5)],
    curls: [...(CURLY.curls ?? []), [24, 60], [96, 60], [22, 78], [98, 78], [24, 96], [96, 96], [30, 104], [90, 104]],
    fade: false
  },
  // Liso e longo, repartido no meio, descendo pelos ombros.
  long: {
    back:
      'M24.6 44 C23.4 24 38 5.6 60 5.6 C82 5.6 96.6 24 95.4 44 C95.8 64 97.6 86 99.4 106 C99.7 109 97.6 111 94.6 110.6 ' +
      'L83.6 109.2 C82.6 100 82.2 90 82.4 82 L37.6 82 C37.8 90 37.4 100 36.4 109.2 L25.4 110.6 C22.4 111 20.3 109 20.6 106 ' +
      'C22.4 86 24.2 64 24.6 44 Z',
    front:
      'M27.6 46 C26.6 24 40 6.4 60 6.4 C80 6.4 93.4 24 92.4 46 L89.4 45.4 C89 37 87 30.4 82.6 26.4 C76.6 21.6 68 19.6 61.4 21 ' +
      'L60 24 L58.6 21 C52 19.6 43.4 21.6 37.4 26.4 C33 30.4 31 37 30.6 45.4 Z',
    strands: [
      'M58.6 21.6 C50 22.4 41 26.6 35 34',
      'M61.4 21.6 C70 22.4 79 26.6 85 34',
      'M55 9 C46 11 38 16 33 24',
      'M65 9 C74 11 82 16 87 24',
      ...SIDE_LOCKS(108),
      'M32 84 C32.4 92 32 100 31 107',
      'M88 84 C87.6 92 88 100 89 107'
    ],
    shine: SHINE_LONG
  },
  // Puxado para trás, com o rabo aparecendo atrás da cabeça, do lado direito.
  ponytail: {
    back:
      'M86.4 20 C97 24 103 40 100.4 58 C99 68 95 75 91.4 73.6 C89.6 72.8 90.6 68 91.4 62 C93 48 92 34 86.4 26 Z',
    front: PULLED,
    strands: [...PULLED_STRANDS, 'M93 32 C96 42 97 52 95 64'],
    shine: SHINE_LOW,
    fade: true
  },
  // Puxado para trás, num coque no alto da cabeça.
  bun: {
    back: 'M49.5 0 A10.5 8.6 0 1 0 70.5 0 A10.5 8.6 0 1 0 49.5 0 Z',
    front: PULLED,
    strands: [...PULLED_STRANDS, 'M54 -3 C57 -6 63 -6 66 -3'],
    shine: SHINE_LOW,
    tie: 'M51.4 6 Q60 9.6 68.6 6',
    fade: true
  },
  // Calvo: o cabelo só dos lados, e o alto da cabeça brilhando.
  balding: {
    front:
      'M28.8 44 C28 38 28.4 32 30.4 27 C31.6 26 33.4 26.6 34.4 28.4 C32.8 32.6 32.2 38 32.4 44 Z ' +
      'M91.2 44 C92 38 91.6 32 89.6 27 C88.4 26 86.6 26.6 85.6 28.4 C87.2 32.6 87.8 38 87.6 44 Z',
    strands: [],
    shine: 'M40 19 Q50 12.6 64 13.4 Q52 16 44 22 Z',
    fade: true
  },
  // Liso, penteado reto para trás com gel (o brilho é maior).
  slickBack: {
    front:
      'M29 40 C27.8 30 30 21 35.6 15 C41.6 8.6 50 5.6 60 5.6 C70 5.6 78.4 8.6 84.4 15 C90 21 92.2 30 91 40 L89.6 39.6 ' +
      'C89.2 33.6 88.4 29.6 86.8 27 C78.6 24 69.4 22.6 60 22.6 C50.6 22.6 41.4 24 33.2 27 C31.6 29.6 30.8 33.6 30.4 39.6 Z',
    strands: [
      'M38 26 C39 18 42 12 46 8.6',
      'M46 24.4 C47 16 49 10.4 52 7',
      'M54 23.4 C54.6 15 55.6 9.4 57 6.2',
      'M62 23 C62 15 62.6 9 63.6 6.2',
      'M70 23.6 C70.4 15.6 71.4 10 73 7',
      'M78 25 C78.6 18 80 12.6 82.4 9.6'
    ],
    shine: 'M42 12 Q56 6 74 8.6 Q58 9 46 15 Z',
    fade: true
  },
  // Joãozinho: curto, com a franja picotada caindo de lado.
  pixie: {
    front:
      'M28.8 42 C27.2 31 29.6 21.6 35.4 15.4 C41.4 9 50 6 60 6 C70.4 6 79.4 9.6 85 16 C90.4 22 92.2 31 91 42 L89.6 41.6 ' +
      'C89.4 36 88.6 32 87 29.6 C82 31.6 76 31.6 70 29.6 C64 32.4 56 33.6 48 32 C42 31 37 29.4 33.2 27.4 C31.4 30 30.6 35 30.2 41.6 Z',
    strands: ['M36 28 C36 22 40 16 46 12', 'M40 30 C42 24 48 18 56 14', 'M52 32.6 C55 25 61 19 70 16', 'M70 30 C73 24 78 20 84 20'],
    shine: SHINE,
    fade: true
  },
  // Cuia: em volta da cabeça, com a franja reta logo acima das sobrancelhas.
  bowl: {
    front:
      'M27.6 46 C26.4 24 40 6.6 60 6.6 C80 6.6 93.6 24 92.4 46 L88.6 45.4 C88.6 40 88.2 36.6 87.6 34.6 L32.4 34.6 ' +
      'C31.8 36.6 31.4 40 31.4 45.4 Z',
    strands: [
      'M36 34 L36.4 24',
      'M42 34.4 L42.2 20',
      'M48 34.4 L48 17',
      'M54 34.4 L54 15.4',
      'M60 34.4 L60 15',
      'M66 34.4 L66 15.4',
      'M72 34.4 L72 17',
      'M78 34.4 L77.8 20',
      'M84 34 L83.6 24'
    ],
    shine: SHINE_LONG
  },
  // Mullet: curto em cima, comprido atrás; de frente, aparece descendo atrás do pescoço.
  mullet: {
    back:
      'M30.4 58 C28.4 70 28.2 84 30.4 96 C33.4 98 37 98 40.4 96 C38.2 89 36.6 81 36 72 C35.4 66 33.4 61 30.4 58 Z ' +
      'M89.6 58 C91.6 70 91.8 84 89.6 96 C86.6 98 83 98 79.6 96 C81.8 89 83.4 81 84 72 C84.6 66 86.6 61 89.6 58 Z',
    front:
      'M28.6 40 C27 30 29.4 20.4 35.6 14.2 C39.6 10.2 45 6 52 4.2 C58.4 2.8 66.8 3.6 74 5.8 C81 8 87.6 12.4 90.2 19.4 ' +
      'C92.4 25.6 92.6 33 91.4 40 L89.6 39.5 C89.2 33.5 88.4 29.4 86.8 27 C78.6 24.4 69.4 23.2 60 23.6 ' +
      'C50.6 24 41.4 25 33.2 27 C31.6 29.4 30.8 33.5 30.4 39.6 Z',
    strands: [...QUIFF_STRANDS.slice(0, 4), 'M31 66 C30 76 30.4 86 32 94', 'M89 66 C90 76 89.6 86 88 94'],
    shine: SHINE,
    fade: true
  },
  // Dreads: mechas grossas e gomadas até os ombros, algumas caindo na testa.
  dreads: {
    back:
      'M24.6 44 C23.4 24 38 5.6 60 5.6 C82 5.6 96.6 24 95.4 44 C96 60 97 78 97.4 92 L86 92 C85 86 84.6 82 84.6 78 L35.4 78 ' +
      'C35.4 82 35 86 34 92 L22.6 92 C23 78 24 60 24.6 44 Z',
    locks: [
      'M24 44 C22.6 60 22.8 76 23.6 96',
      'M28.4 46 C27.6 62 28 80 29 100',
      'M32.6 60 C32 72 32.4 86 33.6 98',
      'M96 44 C97.4 60 97.2 76 96.4 96',
      'M91.6 46 C92.4 62 92 80 91 100',
      'M87.4 60 C88 72 87.6 86 86.4 98'
    ],
    front:
      'M27.6 44 C26.6 24 40 6.4 60 6.4 C80 6.4 93.4 24 92.4 44 L89 43 C88.6 37 87.6 33 86.2 30 C78 27 69 25.6 60 25.6 ' +
      'C51 25.6 42 27 33.8 30 C32.4 33 31.4 37 31 43 Z',
    strands: ['M36 20 C40 14 48 10 56 9', 'M64 9 C72 10 80 14 84 20', 'M44 24 C48 18 54 15 60 14.6', 'M60 14.6 C66 15 72 18 76 24'],
    frontLocks: ['M38 27 C37 32 37.4 36 38.6 39.4', 'M48 25.6 C47.6 30 48 33 49 35.6', 'M72 25.6 C72.4 30 72 33 71 35.6', 'M82 27 C83 32 82.6 36 81.4 39.4'],
    shine: SHINE_LONG
  },
  // Maria-chiquinha: dois rabinhos dos lados, presos com elástico.
  pigtails: {
    back:
      'M29.6 33 C19 34 12.6 46 13 60 C13.4 70 16.6 79 21 84 C23 78 22.8 70 24 62 C25.4 52 27.6 44 32 39.4 Z ' +
      'M90.4 33 C101 34 107.4 46 107 60 C106.6 70 103.4 79 99 84 C97 78 97.2 70 96 62 C94.6 52 92.4 44 88 39.4 Z',
    front: PULLED,
    strands: [...PULLED_STRANDS, 'M60 8 L60 24', 'M24 40 C18 48 17 60 19.6 74', 'M96 40 C102 48 103 60 100.4 74'],
    ties: [
      [30.6, 36.4, 2.6],
      [89.4, 36.4, 2.6]
    ],
    shine: SHINE_LOW,
    fade: true
  },
  // Duas tranças descendo na frente dos ombros.
  braids: {
    back: 'M21.6 111 C21 115 22.4 118 24 119 C25.6 118 27 115 26.4 111 Z M93.6 111 C93 115 94.4 118 96 119 C97.6 118 99 115 98.4 111 Z',
    backBumps: [...braid(25, 46, 24, 104, 9, 4.6), ...braid(95, 46, 96, 104, 9, 4.6)],
    braid: true,
    front: PULLED,
    strands: [...PULLED_STRANDS, 'M60 8 L60 24'],
    ties: [
      [24, 109.6, 2.6],
      [96, 109.6, 2.6]
    ],
    shine: SHINE_LOW,
    fade: true
  }
}

// Barbas, de frente. A faixa passa da borda do rosto; o recorte dele (#face) dá o contorno.
// Rala: costeleta fina, acompanhando a mandíbula até o queixo, com a linha da bochecha descendo até
// o canto da boca. Cheia: sobe mais na bochecha.
const BEARD_STUBBLE =
  'M22 50 L22 100 L98 100 L98 50 L87.6 50 C87.4 57 85.6 63.4 81 67.6 C76 71 70 70.6 60 70.6 C50 70.6 44 71 39 67.6 ' +
  'C34.4 63.4 32.6 57 32.4 50 Z'
const BEARD_FULL =
  'M22 44 L22 100 L98 100 L98 44 L88.4 44 C88 54 86 60.6 81.6 64.6 C76.4 68 70.4 68.4 60 68.4 C49.6 68.4 43.6 68 38.4 64.6 ' +
  'C34 60.6 32 54 31.6 44 Z'
const GOATEE = 'M53 78.4 C53.4 85 56 89.6 60 89.8 C64 89.6 66.6 85 67 78.4 C65 80.4 62.6 81.6 60 81.6 C57.4 81.6 55 80.4 53 78.4 Z'
const SOUL_PATCH = 'M58 77.8 C58.2 79.8 59 81 60 81 C61 81 61.8 79.8 62 77.8 C61.4 78.2 60.6 78.4 60 78.4 C59.4 78.4 58.6 78.2 58 77.8 Z'
// Costeletas: as duas laterais até a mandíbula, com o queixo raspado.
const MUTTON_CHOPS =
  'M22 44 L22 100 L45 100 C44.6 92 45.6 85 48.6 80.4 C44 76.6 38.8 70 36 62 C34.6 57 33.4 50 33 44 Z ' +
  'M98 44 L98 100 L75 100 C75.4 92 74.4 85 71.4 80.4 C76 76.6 81.2 70 84 62 C85.4 57 86.6 50 87 44 Z'
// Barba longa: a parte que desce abaixo do queixo (a de dentro do rosto é a cheia).
const LONG_BEARD = 'M38.6 78 C40 92 48 104 60 106.6 C72 104 80 92 81.4 78 C77 86 69 90.6 60 90.6 C51 90.6 43 86 38.6 78 Z'
const MUSTACHE_LIGHT = 'M47.5 71.3 C50.5 69.3 55.5 69 60 70.2 C64.5 69 69.5 69.3 72.5 71.3 C69.5 72 65.5 71.8 60 72 C54.5 71.8 50.5 72 47.5 71.3 Z'
const MUSTACHE =
  'M47.4 72.2 C48.6 69 54.6 67.6 60 69.4 C65.4 67.6 71.4 69 72.6 72.2 C70 72.8 66 71.6 60 72.4 C54 71.6 50 72.8 47.4 72.2 Z'
const PENCIL_MUSTACHE = 'M50.6 71.2 C54 70 57.6 70 60 70.8 C62.4 70 66 70 69.4 71.2 C66 71.4 62.6 71.2 60 71.6 C57.4 71.2 54 71.4 50.6 71.2 Z'
// Guidão: as pontas enroladas para cima.
const HANDLEBAR =
  'M60 69.6 C56 67.6 51 68 48.4 70.6 C46.6 72.4 44.4 72.6 43 71 C42.2 70 42.6 68.6 43.8 68.6 C43.2 69.8 44.2 70.6 45.4 70 ' +
  'C48 66.8 54.6 66.2 60 68.4 C65.4 66.2 72 66.8 74.6 70 C75.8 70.6 76.8 69.8 76.2 68.6 C77.4 68.6 77.8 70 77 71 ' +
  'C75.6 72.6 73.4 72.4 71.6 70.6 C69 68 64 67.6 60 69.6 Z'

// Barbas com algo além do bigode (desenhadas antes da boca) e as que têm o bigode grosso.
const BEARD_BODY: BeardStyle[] = ['stubble', 'full', 'goatee', 'chinstrap', 'soulPatch', 'muttonChops', 'long']
const THICK_MUSTACHE: BeardStyle[] = ['mustache', 'goatee', 'full', 'long']

function Head({ mouth }: { mouth: Mouth }) {
  const f = useFigure()
  const art = HAIR_FRONT[f.look.hair]
  const beard = f.look.beard
  const detail = FACE_DETAIL[f.look.face]
  return (
    <>
      {art.back && <path d={art.back} fill={f.url('hair')} />}
      {art.backBumps?.map(([cx, cy, r]) => (
        <circle
          key={`${cx} ${cy}`}
          cx={cx}
          cy={cy}
          r={r}
          fill={f.url('hair')}
          stroke={art.braid ? f.hair.bottom : undefined}
          strokeWidth={art.braid ? 0.8 : undefined}
        />
      ))}
      {art.locks && <Locks paths={art.locks} width={3.8} />}
      {!COVERS_EARS[f.look.hair] && (
        <>
          <Ear />
          <g transform={MIRROR}>
            <Ear />
          </g>
        </>
      )}
      <path d={FACES[f.look.face]} fill={f.url('skin')} />
      {detail && <path d={detail} fill="none" stroke={f.skin.line} strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />}
      {art.fade && (
        <>
          <TempleFade />
          <g transform={MIRROR}>
            <TempleFade />
          </g>
        </>
      )}
      <Hair art={art} />
      <ellipse cx={40} cy={58.5} rx={5} ry={2.8} fill="#e88f78" opacity={f.female ? 0.26 : 0.16} />
      <ellipse cx={80} cy={58.5} rx={5} ry={2.8} fill="#e88f78" opacity={f.female ? 0.26 : 0.16} />
      <Brow />
      <g transform={MIRROR}>
        <Brow />
      </g>
      <Eye cx={46} flip={1} />
      <Eye cx={74} flip={-1} />
      <Nose />
      {BEARD_BODY.includes(beard) && <Beard />}
      <MouthShape kind={mouth} />
      {beard === 'stubble' && (
        <>
          <path d={MUSTACHE_LIGHT} fill={f.beard.beard} opacity={0.45} filter={f.url('soft')} />
          <g stroke={f.beard.beard} strokeWidth={0.5} strokeLinecap="round" opacity={0.3}>
            <path d="M50 69.6 L48.8 71.2" />
            <path d="M53.2 69 L52.2 71" />
            <path d="M56.4 69 L55.8 71.2" />
            <path d="M70 69.6 L71.2 71.2" />
            <path d="M66.8 69 L67.8 71" />
            <path d="M63.6 69 L64.2 71.2" />
          </g>
        </>
      )}
      {THICK_MUSTACHE.includes(beard) && (
        <>
          <path d={MUSTACHE} fill={f.beard.beard} opacity={0.92} />
          <g fill="none" stroke={f.beard.strand} strokeWidth={0.5} strokeLinecap="round" opacity={0.5}>
            <path d="M51 70.6 L50 72" />
            <path d="M55 69.6 L54.2 71.4" />
            <path d="M65 69.6 L65.8 71.4" />
            <path d="M69 70.6 L70 72" />
          </g>
        </>
      )}
      {beard === 'pencil' && <path d={PENCIL_MUSTACHE} fill={f.beard.beard} opacity={0.95} />}
      {beard === 'handlebar' && <path d={HANDLEBAR} fill={f.beard.beard} opacity={0.95} />}
      <HeadAccessories />
    </>
  )
}

// ---------- acessórios ----------
// Os da cabeça ficam dentro do desenho dela (crescem e mexem junto); colar, pulseira e relógio, no
// corpo. Cores fixas: dourado, armação escura, boné vermelho, gorro azul, laço rosa.

const GOLD = '#e0b04a'
const GOLD_DARK = '#a87a22'
const FRAME = '#2a2a2e'
const CAP = { mid: '#e0483e', dark: '#a9302a', light: '#f06a5f' }
const BEANIE = { mid: '#3d5a99', dark: '#2a4070', light: '#5f7cbd' }

const useAccessory = () => {
  const list = useFigure().look.accessories
  return (a: Accessory) => list.includes(a)
}

// Lentes centradas nos olhos (x 46 e 74, y 49.6); o lado direito é o esquerdo espelhado.
const AVIATOR_LENS = 'M38 45 C38 43.4 40 43 46 43 C52 43 54.4 43.6 54 46 C53.4 52 50.6 56.4 46.4 56.4 C41.6 56.4 38.4 51.6 38 45 Z'
const SUNGLASS_LENS = 'M37 44 L55 44 L54.2 50.6 C53.6 54.2 51 56 47.6 56 L44 56 C40.4 56 38 54 37.6 50.6 Z'

function Eyewear({ kind }: { kind: 'glasses' | 'aviators' | 'sunglasses' }) {
  const lens = (mirror?: boolean) => {
    const t = mirror ? MIRROR : undefined
    if (kind === 'glasses') return <rect x={38} y={43.8} width={16} height={11.6} rx={4} transform={t} fill="#fff" fillOpacity={0.12} stroke={FRAME} strokeWidth={1.5} />
    if (kind === 'aviators') return <path d={AVIATOR_LENS} transform={t} fill="#2c3e52" fillOpacity={0.82} stroke={GOLD} strokeWidth={1.1} />
    return <path d={SUNGLASS_LENS} transform={t} fill="#16171b" stroke={FRAME} strokeWidth={1.2} strokeLinejoin="round" />
  }
  const frame = kind === 'aviators' ? GOLD : FRAME
  return (
    <>
      <path d="M38 47.4 L30.6 46.2 M82 47.4 L89.4 46.2" stroke={frame} strokeWidth={1.2} strokeLinecap="round" />
      {lens()}
      {lens(true)}
      {kind === 'aviators' ? (
        <path d="M54 44.6 Q60 42.8 66 44.6 M53.6 47 Q60 45.8 66.4 47" fill="none" stroke={GOLD} strokeWidth={1} />
      ) : (
        <path d={kind === 'sunglasses' ? 'M55 45.4 Q60 43.8 65 45.4' : 'M54 48 Q60 45.6 66 48'} fill="none" stroke={FRAME} strokeWidth={kind === 'sunglasses' ? 2 : 1.4} />
      )}
      {kind === 'sunglasses' && <path d="M37 44 L55 44 M65 44 L83 44" stroke={FRAME} strokeWidth={2.2} strokeLinecap="round" />}
      {/* Brilho na lente. */}
      {kind !== 'glasses' && <path d="M41 46.4 L44 45.6 M69 46.4 L72 45.6" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" opacity={0.35} />}
    </>
  )
}

function HeadAccessories() {
  const has = useAccessory()
  const eyewear = (['glasses', 'aviators', 'sunglasses'] as const).find(has)
  return (
    <>
      {has('earrings') && (
        <g fill="none" stroke={GOLD} strokeWidth={1.1}>
          <circle cx={29.4} cy={65.4} r={2.4} />
          <circle cx={90.6} cy={65.4} r={2.4} />
        </g>
      )}
      {eyewear && <Eyewear kind={eyewear} />}
      {has('cap') && (
        <>
          <path d="M27 36 C26 16 41 4 60 4 C79 4 94 16 93 36 C82 31.6 71 30 60 30 C49 30 38 31.6 27 36 Z" fill={CAP.mid} />
          <path d="M60 4.6 L60 30 M46 7 C42 14 40 22 40 31.4 M74 7 C78 14 80 22 80 31.4" fill="none" stroke={CAP.dark} strokeWidth={0.8} opacity={0.6} />
          <path d="M40 9 Q50 5.6 62 6.4 Q50 8 43 12 Z" fill="#fff" opacity={0.18} />
          <circle cx={60} cy={5} r={1.8} fill={CAP.dark} />
          {/* Aba para a frente. */}
          <path d="M27.4 35.4 C38 30.6 82 30.6 92.6 35.4 C90.4 39.4 78 41.4 60 41.4 C42 41.4 29.6 39.4 27.4 35.4 Z" fill={CAP.dark} />
          <path d="M30 35.6 C42 32.6 78 32.6 90 35.6" fill="none" stroke={CAP.light} strokeWidth={0.7} opacity={0.6} />
        </>
      )}
      {has('beanie') && (
        <>
          <path d="M27.6 38 C26 16 41 3 60 3 C79 3 94 16 92.4 38 Z" fill={BEANIE.mid} />
          <path d="M42 8 Q52 4.4 64 5.2 Q52 7 45 11 Z" fill="#fff" opacity={0.15} />
          {/* Barra dobrada, canelada. */}
          <path d="M26.4 30.6 C40 27.6 80 27.6 93.6 30.6 L93 39.6 C80 36.8 40 36.8 27 39.6 Z" fill={BEANIE.dark} />
          <g stroke={BEANIE.mid} strokeWidth={0.8} opacity={0.7}>
            {Array.from({ length: 15 }, (_, i) => 31 + i * 4).map((x) => (
              <path key={x} d={`M${x} 31.2 L${x} 37.2`} />
            ))}
          </g>
          <circle cx={60} cy={1.4} r={5.4} fill={BEANIE.light} />
          <circle cx={58.4} cy={-0.2} r={2} fill="#fff" opacity={0.25} />
        </>
      )}
      {has('bow') && (
        <g stroke="#b8344f" strokeWidth={0.6} strokeLinejoin="round">
          <path d="M80 13 C74 6 67 8 69 13.4 C67 19 74 20 80 13 Z" fill={TIE_COLOR} />
          <path d="M80 13 C86 6 93 8 91 13.4 C93 19 86 20 80 13 Z" fill={TIE_COLOR} />
          <circle cx={80} cy={13} r={2.4} fill="#d9476a" />
        </g>
      )}
    </>
  )
}

// Colar: a corrente na gola e o pingente (de frente; de perfil, só a parte da frente).
function Necklace({ side }: { side?: boolean }) {
  return side ? (
    <>
      <path d="M61.6 91.4 C64.4 95.6 67.4 96.8 70 95.2" fill="none" stroke={GOLD} strokeWidth={0.8} />
      <circle cx={69.2} cy={96.6} r={1.3} fill={GOLD} stroke={GOLD_DARK} strokeWidth={0.4} />
    </>
  ) : (
    <>
      <path d="M51.2 91 C53.6 98.6 66.4 98.6 68.8 91" fill="none" stroke={GOLD} strokeWidth={0.9} />
      <circle cx={60} cy={98.6} r={1.5} fill={GOLD} stroke={GOLD_DARK} strokeWidth={0.4} />
      <circle cx={59.5} cy={98.1} r={0.5} fill="#fff" opacity={0.6} />
    </>
  )
}

// No pulso (antebraço em volta de x 45): a pulseira num braço, o relógio no outro.
function WristItem({ kind }: { kind: 'bracelet' | 'watch' }) {
  if (kind === 'bracelet') {
    return (
      <>
        <path d="M42.4 115.4 C44 116.6 46 116.6 47.6 115.4" fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={45} cy={116.4} r={0.7} fill="#fff" opacity={0.5} />
      </>
    )
  }
  return (
    <>
      <rect x={42.2} y={114.4} width={5.6} height={2.6} rx={0.8} fill="#2b2d34" />
      <circle cx={45} cy={115.7} r={2} fill="#e9ecef" stroke="#8a8f99" strokeWidth={0.6} />
      <path d="M45 114.6 L45 115.7 L45.8 116.2" fill="none" stroke="#2b2d34" strokeWidth={0.4} strokeLinecap="round" />
    </>
  )
}

// Mechas grossas e gomadas (dreads): o contorno escuro e, por cima, a mecha em pedaços.
function Locks({ paths, width }: { paths: string[]; width: number }) {
  const { url, hair } = useFigure()
  return (
    <g fill="none" strokeLinecap="round">
      {paths.map((d) => (
        <g key={d}>
          <path d={d} stroke={hair.bottom} strokeWidth={width + 0.8} />
          <path d={d} stroke={url('hair')} strokeWidth={width - 0.6} strokeDasharray="3.4 1" />
        </g>
      ))}
    </g>
  )
}

// A orelha entra um pouco por baixo do rosto, para encostar nele em qualquer formato.
function Ear() {
  const { url, skin } = useFigure()
  return (
    <>
      <path d="M31.4 46.8 C27.2 45.4 24.6 49.4 25 54.6 C25.4 59.6 27.6 63.6 31.4 63.2 L35 62.8 L35 47 Z" fill={url('skin')} />
      <g fill="none" stroke={skin.line} strokeLinecap="round">
        <path d="M29.6 50 C27.6 50.8 27.2 54.8 28.2 58.2" strokeWidth={1.1} />
        <path d="M28.8 53.2 C29.6 53.8 29.8 55.4 29 56.4" strokeWidth={0.9} />
      </g>
    </>
  )
}

// Laterais curtas: o cabelo vai clareando da têmpora até a orelha.
function TempleFade() {
  return <path d="M28.7 36 C28.3 41 28.6 46 30.2 50.4 L32.4 49.6 C31.7 45 31.6 40.5 32.4 35.5 Z" fill={useFigure().url('fade')} />
}

// Parte do cabelo que fica por cima do rosto, de frente ou de perfil.
function Hair({ art }: { art: HairArt }) {
  const { url, hair } = useFigure()
  return (
    <>
      {art.under && <path d={art.under} fill={url('hair')} opacity={0.35} />}
      <g opacity={art.opacity ?? 1}>
        {art.front && <path d={art.front} fill={url('hair')} />}
        {art.bumps?.map(([cx, cy, r]) => (
          <circle key={`${cx} ${cy}`} cx={cx} cy={cy} r={r} fill={url('hair')} />
        ))}
      </g>
      {art.tie && <path d={art.tie} fill="none" stroke={hair.bottom} strokeWidth={2} strokeLinecap="round" />}
      {art.frontLocks && <Locks paths={art.frontLocks} width={3.2} />}
      {art.ties?.map(([cx, cy, r]) => (
        <circle key={`${cx} ${cy}`} cx={cx} cy={cy} r={r} fill={TIE_COLOR} stroke="#b8344f" strokeWidth={0.6} />
      ))}
      <g fill="none" stroke={hair.strand} strokeWidth={0.9} strokeLinecap="round" opacity={0.55}>
        {art.strands.map((d) => (
          <path key={d} d={d} />
        ))}
        {art.curls?.map((p) => (
          <path key={`${p[0]} ${p[1]}`} d={curl(p)} />
        ))}
      </g>
      {art.shine && <path d={art.shine} fill="#fff" opacity={0.12} />}
    </>
  )
}

// Grossa no masculino; mais fina e arqueada no feminino.
function Brow() {
  const { female, hair } = useFigure()
  return (
    <path
      d={
        female
          ? // Feminina: mais fina e arqueada.
            'M38.4 41.8 C41.4 37.6 47.4 36.8 53.4 39 C53.8 39.3 53.7 40 53.2 40.1 C47.6 38.6 42.6 39.4 39.2 42.6 C38.6 43 38 42.3 38.4 41.8 Z'
          : 'M37.4 40.8 C40.6 38.2 46.6 37.4 53.6 39.4 C54.4 39.7 54.4 41.2 53.5 41.6 C47.4 41.2 42.2 41.4 38.6 43 C37.6 43.4 36.8 41.6 37.4 40.8 Z'
      }
      fill={hair.brow}
    />
  )
}

// Formatos de olho, com o centro na origem e o canto de fora para a esquerda (o olho direito é
// espelhado). white: o branco (e o recorte da íris); lid: pálpebra de cima; flick: risquinho no
// canto; lower: pálpebra de baixo; crease: dobra acima do olho; under: sombra abaixo; iris: raio;
// lid shade: pálpebra pesada (sonolento); lash: deslocamento dos cílios até o canto de fora;
// sparkle: um segundo brilho na íris (grandes). kind: 'dot', só uma bolinha escura; 'closed',
// fechados em arco, sorrindo. wink: o olho direito fechado (piscadinha).
type EyeArt = {
  white: string
  lid: string
  flick: string
  lower: string
  crease: string
  under: string
  iris: number
  shade?: string
  lash: [number, number]
  sparkle?: boolean
  kind?: 'dot' | 'closed' | 'heart'
  wink?: boolean
}

// Olho fechado em arco (sorrindo, e o da piscadinha).
const CLOSED_EYE = 'M-6 1.2 C-3.6 -3 3.6 -3 6 1.2'

const EYES: Record<EyeShape, EyeArt> = {
  almond: {
    white: 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: 'M-7 0.3 C-4.5 -3.7 4.5 -3.8 7 -0.2',
    flick: 'M-6.8 0 L-8.2 -1',
    lower: 'M-5.4 1 C-3 3 3.5 3.1 5.8 0.8',
    crease: 'M-5.5 -3.4 C-2.5 -5.2 3.5 -5.4 6.2 -3.6',
    under: 'M-5 3.1 C-2 4.7 3 4.7 5.6 2.9',
    iris: 2.9,
    lash: [0, 0]
  },
  round: {
    white: 'M-5.8 0 C-5.8 -4.6 5.8 -4.6 5.8 0 C5.8 4.4 -5.8 4.4 -5.8 0 Z',
    lid: 'M-6.4 0.2 C-6.2 -5.4 6.2 -5.4 6.4 -0.2',
    flick: 'M-6.2 -0.4 L-7.6 -1.6',
    lower: 'M-4.8 2.4 C-2.4 4.4 2.6 4.4 4.9 2.3',
    crease: 'M-5.2 -5 C-2.4 -6.8 3 -6.8 5.6 -5.2',
    under: 'M-4.6 4.6 C-2 6 2.6 6 5 4.4',
    iris: 3.3,
    lash: [0.6, -1]
  },
  narrow: {
    white: 'M-6.8 0.4 C-4 -1.9 4 -2.3 6.8 -0.6 C4 1.9 -4 2.2 -6.8 0.4 Z',
    lid: 'M-7.3 0.5 C-4.2 -2.5 4.2 -2.9 7.3 -0.8',
    flick: 'M-7 0.3 L-8.6 -0.4',
    lower: 'M-5.6 1 C-3 2.1 3.4 2.1 5.9 0.4',
    crease: 'M-5 -3 C-2 -4 3 -4.2 6 -3.2',
    under: 'M-5 2.6 C-2 3.8 3 3.8 5.6 2.4',
    iris: 2.6,
    lash: [0, 0.4]
  },
  sleepy: {
    white: 'M-6.4 0.2 C-4.2 -1.4 4.2 -1.6 6.4 -0.1 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: 'M-7 0.4 C-4.4 -1.6 4.4 -1.8 7 -0.1',
    flick: 'M-6.8 0.2 L-8 -0.4',
    lower: 'M-5.4 1 C-3 3 3.5 3.1 5.8 0.8',
    crease: 'M-5.5 -2.6 C-2.5 -4.2 3.5 -4.4 6.2 -2.8',
    under: 'M-5 3.1 C-2 4.7 3 4.7 5.6 2.9',
    iris: 2.9,
    shade: 'M-6.8 -0.4 C-4 -3.8 4 -4 6.8 -0.8 C4 -1.8 -4 -1.6 -6.8 -0.4 Z',
    lash: [0, 1.4]
  },
  upturned: {
    white: 'M-6.8 -1.2 C-4.4 -3.6 4 -2.8 6.2 0.6 C3.6 2.8 -3.6 2.4 -6.8 -1.2 Z',
    lid: 'M-7.4 -1.3 C-4.6 -4.3 4.2 -3.7 6.6 0.4',
    flick: 'M-7.2 -1.4 L-9 -3.2',
    lower: 'M-5.8 -0.2 C-3.4 2.2 3 2.6 5.6 1.2',
    crease: 'M-6 -4.4 C-3 -6.2 3 -5.6 6 -3.2',
    under: 'M-5 2.4 C-2 4 3 4.4 5.6 3.2',
    iris: 2.8,
    lash: [-0.4, -1.4]
  },
  // Cantos de fora caídos.
  downturned: {
    white: 'M-6.8 1.2 C-4.6 -2.8 4.2 -3.4 6.4 -0.6 C3.8 2.6 -3.6 3.2 -6.8 1.2 Z',
    lid: 'M-7.4 1.4 C-4.8 -3.4 4.4 -4 6.8 -0.8',
    flick: 'M-7.2 1.4 L-8.6 2.4',
    lower: 'M-5.8 2 C-3.4 3.6 3 3.2 5.6 0.8',
    crease: 'M-6 -2.6 C-3 -5.4 3 -5.8 6.2 -3.6',
    under: 'M-5.4 4.2 C-2.4 5.4 3 4.8 5.6 3.2',
    iris: 2.9,
    lash: [-0.2, 1.4]
  },
  big: {
    white: 'M-6.6 0 C-6.6 -5.6 6.6 -5.6 6.6 0 C6.6 5.2 -6.6 5.2 -6.6 0 Z',
    lid: 'M-7.2 0.2 C-7 -6.4 7 -6.4 7.2 -0.2',
    flick: 'M-7 -0.6 L-8.6 -2',
    lower: 'M-5.4 3.2 C-2.6 5.4 2.8 5.4 5.6 3.1',
    crease: 'M-6 -6 C-3 -8 3 -8 6.2 -6.2',
    under: 'M-5.2 5.6 C-2.2 7 2.6 7 5.4 5.4',
    iris: 4,
    sparkle: true,
    lash: [0.6, -2]
  },
  // Bem abertos, com a íris pequena no meio do branco.
  wide: {
    white: 'M-6 0 C-6 -5.4 6 -5.4 6 0 C6 5.4 -6 5.4 -6 0 Z',
    lid: 'M-6.6 0 C-6.4 -6.2 6.4 -6.2 6.6 0',
    flick: 'M-6.4 -1 L-7.6 -2.2',
    lower: 'M-5 3.4 C-2.4 5.8 2.6 5.8 5 3.4',
    crease: 'M-5.6 -6.6 C-2.6 -8.2 3 -8.2 5.8 -6.6',
    under: 'M-4.6 6 C-2 7.2 2.4 7.2 4.8 6',
    iris: 2.4,
    lash: [0.4, -1.6]
  },
  // Sem a dobra da pálpebra, um pouco mais estreitos.
  monolid: {
    white: 'M-6.6 0.6 C-4.4 -2.2 4.4 -2.4 6.6 -0.2 C4.2 2 -4.2 2.4 -6.6 0.6 Z',
    lid: 'M-7.2 0.6 C-4.6 -2.8 4.6 -3 7.2 -0.3',
    flick: 'M-7 0.4 L-8.4 -0.2',
    lower: 'M-5.4 1.4 C-3 2.6 3.4 2.6 5.8 0.8',
    crease: '',
    under: 'M-5 3 C-2 4.2 3 4.2 5.6 2.8',
    iris: 2.7,
    lash: [0, 0.6]
  },
  // A pálpebra de cima descendo para o lado do nariz: cara de quem vai resolver.
  determined: {
    white: 'M-6.6 -1.4 C-4 -2.4 3 -1.6 6.4 0.8 C4 3 -4 2.8 -6.6 -1.4 Z',
    lid: 'M-7.2 -1.6 C-4 -2.8 3 -2 6.8 0.6',
    flick: 'M-7 -1.6 L-8.6 -2.2',
    lower: 'M-5.6 0.6 C-3 2.8 3.4 2.8 5.8 1.4',
    crease: 'M-6 -4.2 C-3 -5 3 -4.2 6.4 -2',
    under: 'M-5 3 C-2 4.6 3 4.6 5.6 3',
    iris: 2.8,
    lash: [-0.2, -1.4]
  },
  // Grandes, com a íris enorme e dois brilhos.
  starry: {
    white: 'M-6.6 0 C-6.6 -5.6 6.6 -5.6 6.6 0 C6.6 5.2 -6.6 5.2 -6.6 0 Z',
    lid: 'M-7.2 0.2 C-7 -6.4 7 -6.4 7.2 -0.2',
    flick: 'M-7 -0.6 L-8.6 -2',
    lower: 'M-5.4 3.2 C-2.6 5.4 2.8 5.4 5.6 3.1',
    crease: 'M-6 -6 C-3 -8 3 -8 6.2 -6.2',
    under: 'M-5.2 5.6 C-2.2 7 2.6 7 5.4 5.4',
    iris: 4.6,
    sparkle: true,
    lash: [0.6, -2]
  },
  dot: {
    white: 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: '',
    flick: '',
    lower: '',
    crease: '',
    under: '',
    iris: 2.6,
    lash: [0, 0],
    kind: 'dot'
  },
  happy: {
    white: 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: CLOSED_EYE,
    flick: '',
    lower: '',
    crease: '',
    under: '',
    iris: 2.9,
    lash: [0, 0],
    kind: 'closed'
  },
  wink: {
    white: 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: 'M-7 0.3 C-4.5 -3.7 4.5 -3.8 7 -0.2',
    flick: 'M-6.8 0 L-8.2 -1',
    lower: 'M-5.4 1 C-3 3 3.5 3.1 5.8 0.8',
    crease: 'M-5.5 -3.4 C-2.5 -5.2 3.5 -5.4 6.2 -3.6',
    under: 'M-5 3.1 C-2 4.7 3 4.7 5.6 2.9',
    iris: 2.9,
    lash: [0, 0],
    wink: true
  },
  // Corações no lugar dos olhos.
  hearts: {
    white: 'M-6.4 0.2 C-4.2 -3.2 4.2 -3.2 6.4 0 C4 3 -4 3.2 -6.4 0.2 Z',
    lid: '',
    flick: '',
    lower: '',
    crease: '',
    under: '',
    iris: 2.9,
    lash: [0, 0],
    kind: 'heart'
  }
}

const HEART = 'M0 4.2 C-5.4 0.6 -6.2 -3 -3.6 -4.2 C-1.8 -5 -0.4 -4 0 -2.6 C0.4 -4 1.8 -5 3.6 -4.2 C6.2 -3 5.4 0.6 0 4.2 Z'

// O olho direito é espelhado. A íris não espelha: os dois olham para o mesmo lado quando a pose
// mexe nela (.m-iris).
function Eye({ cx, flip }: { cx: number; flip: 1 | -1 }) {
  const { url, skin, female, look } = useFigure()
  const eye = EYES[look.eyes]
  const color = eyePalette(look.eyeColor)
  const mirror = `scale(${flip} 1)`
  // Cílios no feminino, saindo do canto de fora, deslocados até ele.
  const lashes = ([dx, dy]: [number, number]) =>
    female && (
      <g stroke="#2e2018" strokeWidth={1.1} strokeLinecap="round" transform={`translate(${dx} ${dy})`}>
        <path d="M-6.4 -0.8 L-9.2 -2.8" />
        <path d="M-5 -2.3 L-7.2 -4.9" />
        <path d="M-3.2 -3.1 L-4.4 -5.9" />
        <path d="M-1.2 -3.4 L-1.6 -5.6" />
      </g>
    )
  // Fechado em arco: sorrindo, ou o direito da piscadinha.
  if (eye.kind === 'closed' || (eye.wink && flip === -1)) {
    return (
      <g transform={`translate(${cx} 49.6) ${mirror}`} fill="none" strokeLinecap="round">
        <path d={CLOSED_EYE} stroke="#2e2018" strokeWidth={1.6} />
        {lashes([0.6, 1.6])}
      </g>
    )
  }
  if (eye.kind === 'heart') {
    return (
      <g transform={`translate(${cx} 49.6)`}>
        <g className="m-blink">
          <path d={HEART} fill="#e23d5a" stroke="#a8243c" strokeWidth={0.6} />
          <ellipse cx={-1.9} cy={-2.2} rx={1.1} ry={0.7} fill="#fff" opacity={0.7} transform="rotate(-30 -1.9 -2.2)" />
        </g>
      </g>
    )
  }
  // Bolinha: escura, na cor dos olhos bem fechada, com um brilho.
  if (eye.kind === 'dot') {
    return (
      <g transform={`translate(${cx} 49.6)`}>
        <g className="m-blink">
          <ellipse rx={2.4} ry={3} fill={mix(color.ring, '#000000', 0.35)} />
          <circle cx={0.8} cy={-1.1} r={0.8} fill="#fff" />
        </g>
      </g>
    )
  }
  return (
    <g transform={`translate(${cx} 49.6)`}>
      <path d={eye.under} transform={mirror} fill="none" stroke={skin.line} strokeWidth={1.2} strokeLinecap="round" opacity={0.35} />
      <g className="m-blink">
        <path d={eye.white} transform={mirror} fill="#fbf6f1" />
        <g clipPath={url(`eye-${flip === 1 ? 'l' : 'r'}`)}>
          <g className="m-iris">
            <circle r={eye.iris} fill={color.fill} stroke={color.ring} strokeWidth={0.7} />
            <circle r={eye.iris * 0.47} fill="#17100b" />
            <circle cx={eye.iris * 0.31} cy={-eye.iris * 0.34} r={eye.iris * 0.24} fill="#fff" />
            {eye.sparkle && <circle cx={-eye.iris * 0.32} cy={eye.iris * 0.3} r={eye.iris * 0.13} fill="#fff" opacity={0.85} />}
          </g>
        </g>
        <g transform={mirror} fill="none" strokeLinecap="round">
          {eye.shade && <path d={eye.shade} fill={skin.skin[2]} stroke="none" />}
          {/* No feminino, o traço de cima mais marcado, como um delineado. */}
          <path d={eye.lid} stroke="#2e2018" strokeWidth={female ? 1.9 : 1.5} />
          <path d={eye.flick} stroke="#2e2018" strokeWidth={1} />
          {lashes(eye.lash)}
          <path d={eye.lower} stroke={skin.line} strokeWidth={0.7} opacity={0.6} />
        </g>
      </g>
      <path d={eye.crease} transform={mirror} fill="none" stroke={skin.line} strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />
    </g>
  )
}

function Nose() {
  const { skin } = useFigure()
  return (
    <>
      <g fill="none" strokeLinecap="round">
        <path d="M56.8 50.5 C56.4 55 55.6 59.5 54.6 62.6" stroke={skin.line} strokeWidth={1.5} opacity={0.55} />
        <path d="M63.4 52 C63.8 56 64.6 59.8 65.6 62.4" stroke={skin.soft} strokeWidth={1.1} opacity={0.4} />
      </g>
      <ellipse cx={60} cy={64.4} rx={4.6} ry={2.9} fill={skin.soft} opacity={0.35} />
      <path
        d="M53.4 63.6 C53.6 66.6 56.4 67.8 58.2 67 C59 67.6 61 67.6 61.8 67 C63.6 67.8 66.4 66.6 66.6 63.6"
        fill="none"
        stroke={skin.deep}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <ellipse cx={57.3} cy={66.1} rx={1.3} ry={0.7} fill={skin.nostril} opacity={0.7} transform="rotate(-15 57.3 66.1)" />
      <ellipse cx={62.7} cy={66.1} rx={1.3} ry={0.7} fill={skin.nostril} opacity={0.7} transform="rotate(15 62.7 66.1)" />
      <ellipse cx={60.4} cy={63} rx={2.1} ry={1.3} fill="#fff" opacity={0.3} />
    </>
  )
}

// O que fica no queixo e nas bochechas (o bigode vem por cima da boca, em Head).
function Beard() {
  const { url, beard, look } = useFigure()
  const texture = (d: string, opacity: number) => <path d={d} fill={url('beard-texture')} opacity={opacity} />
  switch (look.beard) {
    case 'goatee':
      return (
        <g fill={beard.beard}>
          <path d={GOATEE} opacity={0.9} />
          {texture(GOATEE, 0.3)}
          {/* Ligação do bigode ao queixo, dos dois lados da boca. */}
          <g fill="none" stroke={beard.beard} strokeWidth={1.6} strokeLinecap="round" opacity={0.75}>
            <path d="M49.6 72.4 C49.2 75.4 50.4 78 53.2 79.4" />
            <path d="M70.4 72.4 C70.8 75.4 69.6 78 66.8 79.4" />
          </g>
        </g>
      )
    case 'soulPatch':
      return <path d={SOUL_PATCH} fill={beard.beard} opacity={0.9} />
    // Uma faixa fina acompanhando a mandíbula, da orelha ao queixo: o contorno do rosto, recortado
    // por dentro dele e só da orelha para baixo.
    case 'chinstrap':
      return (
        <g clipPath={url('face')}>
          <g clipPath={url('jaw')}>
            <path d={FACES[look.face]} fill="none" stroke={beard.beard} strokeWidth={4.6} opacity={0.9} />
          </g>
        </g>
      )
    case 'muttonChops':
      return (
        <g clipPath={url('face')}>
          <path d={MUTTON_CHOPS} fill={url('beard-full')} filter={url('soft')} />
          {texture(MUTTON_CHOPS, 0.35)}
        </g>
      )
    default: {
      const full = look.beard === 'full' || look.beard === 'long'
      const band = full ? BEARD_FULL : BEARD_STUBBLE
      return (
        <>
          <g clipPath={url('face')}>
            <path d={band} fill={url(full ? 'beard-full' : 'beard')} filter={url('soft')} />
            {texture(band, full ? 0.35 : 0.16)}
            <ellipse cx={60} cy={81} rx={3.4} ry={2.6} fill={beard.beard} opacity={0.2} filter={url('soft')} />
          </g>
          {look.beard === 'long' && (
            <>
              <path d={LONG_BEARD} fill={beard.beard} opacity={0.92} />
              {texture(LONG_BEARD, 0.35)}
              <g fill="none" stroke={beard.strand} strokeWidth={0.6} strokeLinecap="round" opacity={0.5}>
                <path d="M50 93 C52 98 55 102 57.6 104" />
                <path d="M70 93 C68 98 65 102 62.4 104" />
                <path d="M60 92.4 L60 104.6" />
              </g>
            </>
          )}
        </>
      )
    }
  }
}

// Linhas da boca fechada: em repouso, sorrindo (cantos para cima), de lado (só o canto direito sobe)
// e séria (cantos um pouco para baixo).
const CALM_LINE = 'M51.8 73.2 C55.5 74.6 64.5 74.6 68.2 73.2'
const SMILE_LINE = 'M51.2 72.6 C55 75.2 65 75.2 68.8 72.6'
const SMIRK_LINE = 'M52.2 73.8 C56 74.8 63.4 74.6 68.8 71.8'
const SERIOUS_LINE = 'M52 74.2 C55.6 73.2 64.4 73.2 68 74.2'
const FROWN_LINE = 'M52.4 75 C55.6 72.6 64.4 72.6 67.6 75'
const LIPS = {
  normal: {
    lower: 'M52.4 73.4 C55 72.9 65 72.9 67.6 73.4 C66.2 76.9 53.8 76.9 52.4 73.4 Z',
    upper: 'M52.2 73.2 C55 72 58 72.2 60 72.7 C62 72.2 65 72 67.8 73.2 C65 73.9 55 73.9 52.2 73.2 Z'
  },
  full: {
    lower: 'M51.6 73.4 C55 72.6 65 72.6 68.4 73.4 C67 78.8 53 78.8 51.6 73.4 Z',
    upper: 'M51.4 73.2 C54.6 70.8 58 71 60 72.1 C62 71 65.4 70.8 68.6 73.2 C65 74.3 55 74.3 51.4 73.2 Z'
  }
}
const TONGUE_FILL = '#e2707d'
const TOOTH_FILL = '#fbfaf7'

// A boca tem o estilo escolhido e reage à pose: `kind` é a expressão (repouso, sorriso no aceno,
// sorrisão no golpe, na dança e na joia). No sorrisão os estilos usam o mesmo, com a língua ou os
// dentões por cima quando é o caso.
function MouthShape({ kind }: { kind: Mouth }) {
  const { look, skin } = useFigure()
  const style = look.mouth
  if (kind === 'grin') {
    return (
      <>
        <Grin />
        {style === 'tongue' && <Tongue grin />}
        {style === 'buck' && <BuckTeeth grin />}
        {style === 'fangs' && <Fangs />}
      </>
    )
  }
  const smile = kind === 'smile'
  switch (style) {
    case 'smile':
      return <Lips line={SMILE_LINE} dimples="both" />
    case 'smallSmile':
      return <path d="M54.4 72.8 Q60 76.6 65.6 72.8" fill="none" stroke={skin.lipLine} strokeWidth={1.3} strokeLinecap="round" />
    case 'pout':
      return <Pout />
    case 'laugh':
      return <Laugh />
    case 'open':
      return <OpenMouth />
    case 'fangs':
      return (
        <>
          <Lips line={smile ? SMILE_LINE : CALM_LINE} />
          <Fangs />
        </>
      )
    case 'frown':
      return <Lips line={smile ? CALM_LINE : FROWN_LINE} />
    case 'smirk':
      return <Lips line={SMIRK_LINE} dimples="right" />
    case 'full':
      return <Lips line={smile ? SMILE_LINE : CALM_LINE} full />
    case 'thin':
      return <ThinMouth smile={smile} />
    case 'teeth':
      return <OpenSmile />
    case 'tongue':
      return (
        <>
          <Lips line={SMILE_LINE} />
          <Tongue />
        </>
      )
    case 'buck':
      return (
        <>
          <Lips line={smile ? SMILE_LINE : CALM_LINE} />
          <BuckTeeth />
        </>
      )
    case 'serious':
      return <Lips line={smile ? CALM_LINE : SERIOUS_LINE} />
    default:
      return <Lips line={smile ? SMILE_LINE : CALM_LINE} />
  }
}

// Boca fechada: os dois lábios e a linha entre eles. No feminino, um pouco mais rosada. dimples:
// covinhas nos cantos.
function Lips({ line, full, dimples }: { line: string; full?: boolean; dimples?: 'both' | 'right' }) {
  const { url, skin, female } = useFigure()
  const { lower, upper } = full ? LIPS.full : LIPS.normal
  return (
    <>
      <path d={lower} fill={url('lip')} />
      <path d={upper} fill={skin.lipTop} />
      {female && (
        <g fill="#e0607a" opacity={0.28}>
          <path d={lower} />
          <path d={upper} />
        </g>
      )}
      <path d={line} fill="none" stroke={skin.lipLine} strokeWidth={1} strokeLinecap="round" />
      <ellipse cx={60} cy={full ? 75.8 : 75} rx={full ? 3.6 : 3} ry={full ? 1 : 0.8} fill="#fff" opacity={0.22} />
      {dimples && (
        <g fill="none" stroke={skin.line} strokeWidth={0.8} strokeLinecap="round" opacity={0.55}>
          {dimples === 'both' && <path d="M50 71.4 C49.4 72.4 49.8 73.6 50.8 74.2" />}
          <path d="M70 71 C70.6 72 70.2 73.2 69.2 73.8" />
        </g>
      )}
    </>
  )
}

// Só a linha, sem o desenho dos lábios, e a sombrinha do lábio de baixo.
function ThinMouth({ smile }: { smile: boolean }) {
  const { skin } = useFigure()
  return (
    <>
      <path
        d={smile ? 'M52.2 73 C55.6 75 64.4 75 67.8 73' : 'M52.8 73.6 C56 74.3 64 74.3 67.2 73.6'}
        fill="none"
        stroke={skin.lipLine}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path d="M56.4 75.8 C58.6 76.4 61.4 76.4 63.6 75.8" fill="none" stroke={skin.line} strokeWidth={0.8} strokeLinecap="round" opacity={0.45} />
    </>
  )
}

// Sorrisão: boca aberta com os dentes de cima e a língua no fundo.
function Grin() {
  const { skin } = useFigure()
  return (
    <>
      <path d="M51 72.6 C55 74.2 65 74.2 69 72.6 C68 79.5 63.5 81.4 60 81.4 C56.5 81.4 52 79.5 51 72.6 Z" fill="#4a1f1c" />
      <path d="M52.2 73.3 C56 74.6 64 74.6 67.8 73.3 L67.2 75.9 C63.5 76.9 56.5 76.9 52.8 75.9 Z" fill={TOOTH_FILL} />
      <path d="M54.5 79.6 C57 78 63 78 65.5 79.6 C63.5 81 56.5 81 54.5 79.6 Z" fill="#c96b67" />
      <path d="M51.6 75 C53 80.5 57 82.3 60 82.3 C63 82.3 67 80.5 68.4 75" fill="none" stroke={skin.lip[0]} strokeWidth={1.4} strokeLinecap="round" />
    </>
  )
}

// Sorriso aberto menor, com os dentes de cima à mostra (estilo "dentes à mostra" em repouso).
function OpenSmile() {
  const { skin } = useFigure()
  return (
    <>
      <path d="M51.6 72.6 C55 74 65 74 68.4 72.6 C67.4 77.4 63.4 79 60 79 C56.6 79 52.6 77.4 51.6 72.6 Z" fill="#4a1f1c" />
      <path d="M52.6 73.1 C56 74.3 64 74.3 67.4 73.1 L66.9 75.2 C63.5 76 56.5 76 53.1 75.2 Z" fill={TOOTH_FILL} />
      <path d="M55.6 77.6 C57.8 76.6 62.2 76.6 64.4 77.6 C62.6 78.7 57.4 78.7 55.6 77.6 Z" fill="#c96b67" />
      <path d="M52 74.4 C53.4 78.4 57 79.8 60 79.8 C63 79.8 66.6 78.4 68 74.4" fill="none" stroke={skin.lip[0]} strokeWidth={1.3} strokeLinecap="round" />
    </>
  )
}

// Língua para fora, saindo do meio da boca (fechada ou no sorrisão).
function Tongue({ grin }: { grin?: boolean }) {
  return grin ? (
    <>
      <path d="M56.2 78.2 C56 82.8 57.8 85 60.2 85 C62.6 85 64.2 82.6 64 78.2 C62 79.2 58.2 79.2 56.2 78.2 Z" fill={TONGUE_FILL} />
      <path d="M60.1 79.4 L60.2 83" stroke="#b84a58" strokeWidth={0.7} strokeLinecap="round" />
    </>
  ) : (
    <>
      <path d="M56.8 74.6 C56.6 78.8 58.2 80.8 60.4 80.8 C62.6 80.8 64 78.6 63.8 74.6 C62 75.2 58.6 75.2 56.8 74.6 Z" fill={TONGUE_FILL} />
      <path d="M60.3 75.6 L60.4 78.8" stroke="#b84a58" strokeWidth={0.7} strokeLinecap="round" />
    </>
  )
}

// Biquinho: os lábios pequenos e cheios, juntos no meio.
function Pout() {
  const { url, skin, female } = useFigure()
  const lips = 'M55.4 73.6 C56.4 70.8 63.6 70.8 64.6 73.6 C63.6 77.2 56.4 77.2 55.4 73.6 Z'
  return (
    <>
      <path d={lips} fill={url('lip')} />
      {female && <path d={lips} fill="#e0607a" opacity={0.28} />}
      <path d="M56.4 73.6 C58.4 74.4 61.6 74.4 63.6 73.6" fill="none" stroke={skin.lipLine} strokeWidth={0.9} strokeLinecap="round" />
      <ellipse cx={60} cy={75.4} rx={2} ry={0.7} fill="#fff" opacity={0.25} />
    </>
  )
}

// Gargalhada: boca bem aberta, os dentes de cima e a língua.
function Laugh() {
  const { skin } = useFigure()
  return (
    <>
      <path d="M50.4 71.6 C55 72.8 65 72.8 69.6 71.6 C68.4 79.8 63.8 83 60 83 C56.2 83 51.6 79.8 50.4 71.6 Z" fill="#4a1f1c" />
      <path d="M51.4 72.2 C55.6 73.2 64.4 73.2 68.6 72.2 L68.1 74.6 C64 75.4 56 75.4 51.9 74.6 Z" fill={TOOTH_FILL} />
      <ellipse cx={60} cy={80} rx={4.6} ry={2.2} fill={TONGUE_FILL} />
      <path d="M51 74 C52.6 80.6 56.6 83.8 60 83.8 C63.4 83.8 67.4 80.6 69 74" fill="none" stroke={skin.lip[0]} strokeWidth={1.4} strokeLinecap="round" />
    </>
  )
}

// Surpresa: um "O" pequeno.
function OpenMouth() {
  const { skin } = useFigure()
  return (
    <>
      <ellipse cx={60} cy={74.4} rx={3.2} ry={3.8} fill="#4a1f1c" stroke={skin.lip[0]} strokeWidth={1.2} />
      <ellipse cx={60} cy={76.6} rx={1.8} ry={1} fill={TONGUE_FILL} />
    </>
  )
}

// Dois caninos pontudos saindo do lábio de cima.
function Fangs() {
  return (
    <g fill={TOOTH_FILL} stroke="#d6cfc4" strokeWidth={0.3}>
      <path d="M55.4 73.4 L57.6 73.4 L56.6 76.4 Z" />
      <path d="M62.4 73.4 L64.6 73.4 L63.4 76.4 Z" />
    </g>
  )
}

// Os dois dentes da frente aparecendo abaixo do lábio de cima (maiores no sorrisão).
function BuckTeeth({ grin }: { grin?: boolean }) {
  const bottom = grin ? 79 : 77.1
  return (
    <g fill={TOOTH_FILL} stroke="#d6cfc4" strokeWidth={0.3}>
      <path d={`M57.5 73.5 L59.8 73.7 L59.8 ${bottom - 0.6} C59.8 ${bottom - 0.2} 59.5 ${bottom} 59 ${bottom} L58.3 ${bottom} C57.8 ${bottom} 57.5 ${bottom - 0.3} 57.5 ${bottom - 0.8} Z`} />
      <path d={`M60.2 73.7 L62.5 73.5 L62.5 ${bottom - 0.8} C62.5 ${bottom - 0.3} 62.2 ${bottom} 61.7 ${bottom} L61 ${bottom} C60.5 ${bottom} 60.2 ${bottom - 0.2} 60.2 ${bottom - 0.6} Z`} />
    </g>
  )
}

// ---------- corpo ----------
// O formato do corpo (magro, médio, forte, gordinho) alarga a camiseta e a calça, afasta os ombros e
// os quadris e engrossa braços e pernas; o gordinho ganha barriga e o forte, o peitoral marcado.

// Contorno do tronco, que a roupa de cima veste. Masculino: ombros em x 43.5-76.5, afinando até a
// cintura em x 46-74.
const TORSO_MALE =
  'M46.5 92.4 C50.5 89.6 55 88.6 60 88.6 C65 88.6 69.5 89.6 73.5 92.4 C76 94 76.9 97 76.6 100.5 C76.2 105.5 75 111.5 74 118 ' +
  'L73.6 123.4 C73.5 125 72.7 126 71.4 126 L48.6 126 C47.3 126 46.5 125 46.4 123.4 L46 118 C45 111.5 43.8 105.5 43.4 100.5 ' +
  'C43.1 97 44 94 46.5 92.4 Z'
// Feminino: ombros mais estreitos, cintura bem marcada em y 110.4 e o quadril abrindo até a barra
// (ampulheta).
const TORSO_FEMALE =
  'M48.6 92.4 C51.8 89.8 55.7 88.9 60 88.9 C64.3 88.9 68.2 89.8 71.4 92.4 C73.6 93.8 74.4 95.8 74.2 98.6 C74 102.4 72.4 106.6 70.6 110.4 ' +
  'C71.4 113.4 73.6 116.4 74.4 119.4 L74.8 123.6 C74.9 125.1 74.1 126 72.8 126 L47.2 126 C45.9 126 45.1 125.1 45.2 123.6 ' +
  'L45.6 119.4 C46.4 116.4 48.6 113.4 49.4 110.4 C47.6 106.6 46 102.4 45.8 98.6 C45.6 95.8 46.4 93.8 48.6 92.4 Z'
// Barriga do gordinho, que sai um pouco do contorno.
const BELLY = { cx: 60, cy: 112.6, rx: 17, ry: 11.4 }

// Regata: alças e o decote fundo; o resto vem do contorno (recortado por ele).
const TANK =
  'M48.8 89 L53.6 89 C55 97.8 65 97.8 66.4 89 L71.2 89 L72 95.4 C76 97 79 100 80 104 L80 132 L40 132 L40 104 C41 100 44 97 48 95.4 Z'
const TANK_NECK = 'M53.6 89.6 C55 97.8 65 97.8 66.4 89.6'
// Jaqueta aberta: cada lado vai da borda até a abertura no meio, recortado pelo contorno.
const JACKET_LEFT = 'M30 80 L52.8 89.2 C54.6 96 55.8 104 56.4 112 L56.8 132 L30 132 Z'
const JACKET_LAPEL = 'M52.8 89.2 L48.6 92.4 L55.2 104 C54.6 98.6 53.8 93.6 52.8 89.2 Z'
// Camisa: as duas pontas da gola.
const SHIRT_COLLAR = 'M51 89.4 L59.6 94.8 L55.4 98.6 L49.2 91.2 Z'

// Tronco com a roupa de cima escolhida. Tudo dentro do contorno (mais a barriga), pelo recorte
// #torso: assim a regata e a jaqueta acompanham qualquer corpo.
function Torso() {
  const { look, female, build, top, url } = useFigure()
  const outline = female ? TORSO_FEMALE : TORSO_MALE
  const base = (fill: string) => (
    <>
      <path d={outline} fill={fill} />
      {build.belly && <ellipse {...BELLY} fill={fill} />}
    </>
  )
  const hem = <path d={female ? 'M45.6 123.4 L74.4 123.4' : 'M46.6 123.4 L73.4 123.4'} stroke={top.hem} strokeWidth={1} opacity={0.5} />
  switch (look.top) {
    case 'tank':
      return (
        <>
          {base(url('limb'))}
          <g clipPath={url('torso')}>
            <path d={TANK} fill={url('shirt')} />
          </g>
          <path d={TANK_NECK} fill="none" stroke={top.collar} strokeWidth={1.3} strokeLinecap="round" />
          <Folds />
          {hem}
        </>
      )
    case 'blouse':
      return (
        <>
          {base(url('shirt'))}
          <Folds />
          {/* Decote em V com babado e um lacinho; faixa na cintura, a barra abrindo embaixo. */}
          <path d="M50.4 90.4 C53.6 93.6 57.4 97.6 60 100 C62.6 97.6 66.4 93.6 69.6 90.4 C66.4 89.2 63.2 88.9 60 88.9 C56.8 88.9 53.6 89.2 50.4 90.4 Z" fill={url('limb')} />
          <path d="M50.4 90.4 C53.6 93.6 57.4 97.6 60 100 C62.6 97.6 66.4 93.6 69.6 90.4" fill="none" stroke={top.collar} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M50.4 90.4 C53.6 93.6 57.4 97.6 60 100 C62.6 97.6 66.4 93.6 69.6 90.4" fill="none" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" strokeDasharray="0.1 1.8" opacity={0.7} />
          <path d="M60 100.6 L56.6 98.6 L56.8 102.6 Z M60 100.6 L63.4 98.6 L63.2 102.6 Z" fill={top.collar} />
          <circle cx={60} cy={100.6} r={1.1} fill={top.fold} />
          <g clipPath={url('torso')}>
            <path d="M40 109.4 Q60 111.4 80 109.4 L80 112 Q60 114 40 112 Z" fill={top.collar} opacity={0.85} />
          </g>
          {hem}
        </>
      )
    case 'shirt':
      return (
        <>
          {base(url('shirt'))}
          <Folds />
          <ellipse cx={60} cy={99.5} rx={9} ry={3.6} fill="#000" opacity={0.1} />
          {/* Gola com as duas pontas, a carreira de botões e, no masculino, o bolso. */}
          <path d="M59.4 95 L60.6 95 L60.4 126 L59.6 126 Z" fill={top.fold} opacity={0.45} />
          {[101, 107, 113, 119].map((y) => (
            <circle key={y} cx={60} cy={y} r={0.8} fill={top.collar} />
          ))}
          {!female && <path d="M64.6 100.4 L70.4 100.4 L70.2 105.2 Q67.5 106.4 64.8 105.2 Z" fill="none" stroke={top.fold} strokeWidth={0.7} opacity={0.6} />}
          <path d={SHIRT_COLLAR} fill={url('shirt')} stroke={top.collar} strokeWidth={0.7} strokeLinejoin="round" />
          <path d={SHIRT_COLLAR} transform={MIRROR} fill={url('shirt')} stroke={top.collar} strokeWidth={0.7} strokeLinejoin="round" />
          {hem}
        </>
      )
    case 'jacket':
      return (
        <>
          {/* Camiseta branca por baixo, e a jaqueta aberta por cima. */}
          {base(url('inner'))}
          <path d="M50.6 90.6 C53.8 96 66.2 96 69.4 90.6" fill="none" stroke="#d6d6d0" strokeWidth={2.2} strokeLinecap="round" />
          <g clipPath={url('torso')}>
            <path d={JACKET_LEFT} fill={url('shirt')} />
            <path d={JACKET_LEFT} transform={MIRROR} fill={url('shirt')} />
            <path d="M44 124 L56.6 124 M63.4 124 L76 124" stroke={top.collar} strokeWidth={3.2} />
          </g>
          <path d={JACKET_LAPEL} fill={top.collar} />
          <path d={JACKET_LAPEL} transform={MIRROR} fill={top.collar} />
          <path d="M48.4 114.4 L52 118.4 M71.6 114.4 L68 118.4" stroke={top.fold} strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />
        </>
      )
    default:
      return (
        <>
          {base(url('shirt'))}
          <Folds />
          {female ? (
            <>
              {/* Gola mais aberta: aparece um pouco do colo. */}
              <path d="M50.8 90.6 C53.2 97.4 66.8 97.4 69.2 90.6 C66 89.4 63 89 60 89 C57 89 54 89.4 50.8 90.6 Z" fill={url('limb')} />
              <ellipse cx={60} cy={100.5} rx={9} ry={3.2} fill="#000" opacity={0.08} />
              <path d="M50.8 90.6 C53.2 97.4 66.8 97.4 69.2 90.6" fill="none" stroke={top.collar} strokeWidth={2} strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Sombra do queixo no peito e a gola careca. */}
              <ellipse cx={60} cy={99.5} rx={11} ry={4.4} fill="#000" opacity={0.13} />
              <path d="M50 90.4 C53.5 96.4 66.5 96.4 70 90.4" fill="none" stroke={top.collar} strokeWidth={2.6} strokeLinecap="round" />
            </>
          )}
          {hem}
        </>
      )
  }
}

// Dobras da roupa: peitoral no forte, barriga no gordinho, busto no feminino, e as laterais da
// cintura no resto.
function Folds() {
  const { female, build, top } = useFigure()
  return (
    <>
      {build.belly && (
        <>
          <path d="M47.6 120.4 Q60 126.6 72.4 120.4" fill="none" stroke={top.fold} strokeWidth={0.9} strokeLinecap="round" opacity={0.4} />
          <path d="M52 108 Q60 104.6 68 108" fill="none" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.18} />
        </>
      )}
      {female && (
        <>
          {/* Busto: o volume clareando em cima e a curva embaixo. */}
          <ellipse cx={54.2} cy={101.2} rx={4.4} ry={3.2} fill="#fff" opacity={0.12} />
          <ellipse cx={65.8} cy={101.2} rx={4.4} ry={3.2} fill="#fff" opacity={0.12} />
        </>
      )}
      <g fill="none" stroke={top.fold} strokeWidth={0.9} strokeLinecap="round" opacity={0.35}>
        {female ? (
          <>
            <path d="M49.4 102.4 Q54.2 107.2 59 104" />
            <path d="M70.6 102.4 Q65.8 107.2 61 104" />
          </>
        ) : build.chest ? (
          <>
            <path d="M48.6 101.4 Q54 106 59.2 103.4" />
            <path d="M71.4 101.4 Q66 106 60.8 103.4" />
            <path d="M60 104 L60 114" />
          </>
        ) : (
          !build.belly && (
            <>
              <path d="M51 107 Q53.5 111.5 55.5 117" />
              <path d="M69 107 Q66.5 111.5 64.5 117" />
            </>
          )
        )}
      </g>
    </>
  )
}

// Parte de cima da calça (o quadril, entre as pernas), atrás da barra da blusa. Na saia, não tem.
function Hips() {
  const { female, url } = useFigure()
  return (
    <path
      d={
        female
          ? 'M45.6 118 L74.4 118 L74.8 127.5 C69.2 129.4 64.6 130.4 60 131 C55.4 130.4 50.8 129.4 45.2 127.5 Z'
          : 'M47 118 L73 118 L73.4 127.5 C68.5 129 64.5 130 60 131 C55.5 130 51.5 129 46.6 127.5 Z'
      }
      fill={url('jeans')}
    />
  )
}

// Saia rodada, por cima das pernas; as pregas marcadas e o cós.
const SKIRT =
  'M46.2 117.5 L73.8 117.5 C75.8 122.6 78 128.4 79.2 133.6 C72.6 135.6 66.4 136.3 60 136.3 C53.6 136.3 47.4 135.6 40.8 133.6 C42 128.4 44.2 122.6 46.2 117.5 Z'

function Skirt() {
  const { url, bottom } = useFigure()
  return (
    <>
      <path d={SKIRT} fill={url('jeans')} />
      <g stroke={bottom.fold} strokeWidth={0.8} strokeLinecap="round" opacity={0.55}>
        <path d="M53.2 121 L50.6 135.4" />
        <path d="M60 121 L60 136" />
        <path d="M66.8 121 L69.4 135.4" />
      </g>
      <path d="M41.4 133.2 C53.6 136.6 66.4 136.6 78.6 133.2" fill="none" stroke={bottom.collar} strokeWidth={1.1} strokeLinecap="round" opacity={0.7} />
    </>
  )
}

function Sneaker() {
  return (
    <>
      <path
        d="M48 143.4 C48 140.2 49.8 139 52 139 L55.4 139 C57.8 139 59 140.4 59 143.4 L59 145 C59 146.4 58.2 147 57 147 L49.4 147 C48.6 147 48 146.4 48 145 Z"
        fill="#2b2d34"
      />
      <path d="M50.2 140.8 Q53.5 139.8 57 140.8" fill="none" stroke="#4a4d56" strokeWidth={0.7} />
      <rect x={48} y={145.4} width={11} height={1.6} rx={0.8} fill="#e6e6e6" />
    </>
  )
}

// Perna esquerda de frente, do quadril (y 120) ao tênis. A calça vai até o tênis; bermuda e shorts
// param no joelho e no meio da coxa, com a perna aparecendo embaixo; na saia, a perna toda aparece.
// No feminino, a coxa mais cheia afinando até o tornozelo.
const LEG = {
  male: {
    pants: 'M49.8 120 L57.2 120 L56.8 140.6 C56.7 142 56 142.8 54.8 142.8 L52.2 142.8 C51 142.8 50.3 142 50.2 140.6 Z',
    skin: 'M50.4 120 L56.6 120 C56.6 126 56.4 133 56.2 140 L50.8 140 C50.6 133 50.4 126 50.4 120 Z',
    bermuda: 'M49.2 119 L57.8 119 L57.6 135 C54.8 135.7 52.2 135.7 49.4 135 Z',
    shorts: 'M49.2 119 L57.8 119 L58.2 128 C55.2 128.8 51.8 128.8 48.8 128 Z',
    seam: 'M55.6 124 L55.4 139'
  },
  female: {
    pants: 'M49 120 L58 120 C58 126 57 133 56.4 139 L56.2 141 C56.1 142.2 55.5 142.8 54.6 142.8 L52.6 142.8 C51.7 142.8 51.2 142.2 51.1 141 L50.9 139 C50.2 133 49 126 49 120 Z',
    skin: 'M49.6 120 L57.4 120 C57.4 126 56.5 132.6 55.8 140 L51.4 140 C50.8 132.6 49.6 126 49.6 120 Z',
    bermuda: 'M48.6 119 L58.4 119 C58.4 124 57.8 129 57.4 134 C54.8 134.7 52 134.7 49.6 134 C49.2 129 48.6 124 48.6 119 Z',
    shorts: 'M48.4 119 L58.6 119 L58.4 127 C55.2 127.8 51.8 127.8 48.4 127 Z',
    seam: 'M55.8 124 C55.6 129 55.2 134 54.8 139'
  }
}

function Leg() {
  const { url, skin, bottom, female, look } = useFigure()
  const leg = female ? LEG.female : LEG.male
  const kind = look.bottom
  return (
    <>
      {kind === 'pants' ? (
        <>
          <path d={leg.pants} fill={url('jeans')} />
          <path d={leg.seam} fill="none" stroke={bottom.fold} strokeWidth={0.7} opacity={0.6} />
        </>
      ) : (
        <>
          <path d={leg.skin} fill={url('limb')} />
          {/* Joelho. */}
          <path d={female ? 'M51.6 131.4 Q53.6 132.4 55.6 131.4' : 'M51.6 131.6 Q53.5 132.6 55.4 131.6'} fill="none" stroke={skin.line} strokeWidth={0.6} strokeLinecap="round" opacity={0.45} />
          {kind !== 'skirt' && (
            <>
              <path d={leg[kind]} fill={url('jeans')} />
              <path d={leg[kind]} fill="none" stroke={bottom.collar} strokeWidth={0.6} opacity={0.5} />
            </>
          )}
        </>
      )}
      <Sneaker />
    </>
  )
}

// Braço de cima (do ombro ao cotovelo) e antebraço, com a manga da roupa escolhida. Desenhados em
// volta de x 45 (o braço esquerdo de frente); o de perfil usa os mesmos, deslocados.
const UPPER_SKIN = 'M41.4 93.8 C42.8 91.6 47.2 91.6 48.6 93.8 L48.2 105.8 C46.2 106.8 43.8 106.8 41.8 105.8 Z'
const SLEEVE = 'M40.8 93.6 C42.2 91.2 47.8 91.2 49.2 93.6 L49.6 105.8 C47 107.2 43 107.2 40.4 105.8 Z'
const SLEEVE_CUFF = 'M40.6 105.2 C43.2 106.6 46.8 106.6 49.4 105.2'
// Manga curtinha da camiseta feminina.
const CAP_SLEEVE = 'M41 93.6 C42.4 91.2 47.6 91.2 49 93.6 L49.4 101.6 C46.8 103 43.2 103 40.6 101.6 Z'
const CAP_CUFF = 'M40.8 101 C43.2 102.4 46.8 102.4 49.2 101'
// Manga bufante da blusinha, franzida na barra.
const PUFF_SLEEVE = 'M39.6 94.2 C39.6 89.2 50.4 89.2 50.4 94.2 L50.6 100.8 C47.4 103 42.6 103 39.4 100.8 Z'
const PUFF_CUFF = 'M39.8 100.4 C43 102.4 47 102.4 50.2 100.4'

function UpperArm() {
  const { url, look, female, top, sleeve } = useFigure()
  const cuff = (d: string, width = 1.1) => <path d={d} fill="none" stroke={sleeve.cuff} strokeWidth={width} strokeLinecap="round" />
  switch (look.top) {
    case 'tank':
      return <path d={UPPER_SKIN} fill={url('limb')} />
    case 'blouse':
      return (
        <>
          <path d={UPPER_SKIN} fill={url('limb')} />
          <path d={PUFF_SLEEVE} fill={url('sleeve')} />
          {cuff(PUFF_CUFF, 1.3)}
          <path d="M42.4 92.4 L43 96 M45 91.6 L45 95.4 M47.6 92.4 L47 96" stroke={top.fold} strokeWidth={0.6} strokeLinecap="round" opacity={0.4} />
        </>
      )
    case 'jacket':
      // Manga comprida: continua no antebraço.
      return <path d={SLEEVE} fill={url('sleeve')} />
    case 'shirt':
      return (
        <>
          <path d={SLEEVE} fill={url('sleeve')} />
          {cuff(SLEEVE_CUFF, 1.8)}
        </>
      )
    default:
      return female ? (
        <>
          <path d={UPPER_SKIN} fill={url('limb')} />
          <path d={CAP_SLEEVE} fill={url('sleeve')} />
          {cuff(CAP_CUFF)}
        </>
      ) : (
        <>
          <path d={SLEEVE} fill={url('sleeve')} />
          {cuff(SLEEVE_CUFF)}
        </>
      )
  }
}

// Antebraço: a pele, ou a manga da jaqueta até o punho. wrist: a pulseira ou o relógio, se escolhido.
function Forearm({ wrist }: { wrist?: 'bracelet' | 'watch' }) {
  const { url, skin, look, sleeve } = useFigure()
  const item = wrist && look.accessories.includes(wrist) && <WristItem kind={wrist} />
  if (look.top === 'jacket') {
    return (
      <>
        <path d="M41.8 104.4 L48.2 104.4 L47.8 118.6 C47 119.6 43 119.6 42.2 118.6 Z" fill={url('sleeve')} />
        <path d="M42.2 117.4 C44 118.4 46 118.4 47.8 117.4" fill="none" stroke={sleeve.cuff} strokeWidth={1.4} strokeLinecap="round" />
        {item}
      </>
    )
  }
  return (
    <>
      <path d="M42.4 105 L47.6 105 L47.2 118.2 C46.6 119.4 43.4 119.4 42.8 118.2 Z" fill={url('limb')} />
      <path d="M43.2 107.5 L43.5 117.5" stroke={skin.line} strokeWidth={0.8} strokeLinecap="round" opacity={0.45} />
      {item}
    </>
  )
}

// Braço esquerdo pendurado do ombro (45, 95): manga, antebraço a partir do cotovelo (45, 107) e a
// mão em (45, 121). O direito é este espelhado; nos dois, ângulo positivo levanta para fora.
// item: o cabo do chicote, a luva de boxe ou a lupa, na mão. Corpo mais largo: o ombro sai para
// fora e o braço engrossa em volta do próprio eixo.
function Arm({ side, hand, item }: { side: 'l' | 'r'; hand: Hand; item?: 'whip' | 'glove' | 'lens' }) {
  const { build } = useFigure()
  const thick = widen(45, build.arm)
  return (
    <g transform={shift(-build.shoulder)}>
      <Pivot x={45} y={95} pose={`m-arm-${side}`} move={`m-arm-${side}-move`}>
        <Pivot x={45} y={107} pose={`m-fore-${side}`} move={`m-fore-${side}-move`}>
          {item === 'whip' && (
            <>
              <rect x={43.5} y={121} width={3} height={11} rx={1.5} fill="#4a2c17" />
              <path d="M44.4 123 L44.4 131" stroke="#7a4b2a" strokeWidth={0.6} strokeLinecap="round" />
            </>
          )}
          {item === 'lens' && <Lens />}
          <g transform={thick}>
            <Forearm wrist={side === 'l' ? 'bracelet' : 'watch'} />
            <HandShape kind={hand} />
          </g>
          {item === 'glove' && <Glove />}
        </Pivot>
        <g transform={thick}>
          <UpperArm />
        </g>
      </Pivot>
    </g>
  )
}

// Mão com o centro em (45, 121), dedos para baixo (para longe do cotovelo); o polegar fica do lado
// de dentro. Na joia, o polegar sai na ponta: com o antebraço para cima, aponta para cima.
function HandShape({ kind }: { kind: Hand }) {
  const { url, skin } = useFigure()
  if (kind === 'open') {
    return (
      <>
        <path d="M41.8 117.8 C41 121 41.8 125.2 45 125.6 C48.2 125.2 49 121 48.2 117.8 Z" fill={url('limb')} />
        <ellipse cx={48.3} cy={119.8} rx={1.3} ry={2.6} fill={skin.soft} transform="rotate(-25 48.3 119.8)" />
        <path d="M43.8 122.8 L44 124.8 M46.1 122.8 L46 124.8" stroke={skin.line} strokeWidth={0.5} strokeLinecap="round" opacity={0.5} />
      </>
    )
  }
  return (
    <>
      {kind === 'thumb' && (
        <>
          <rect x={43.6} y={122.4} width={2.8} height={7} rx={1.4} fill={skin.soft} />
          <ellipse cx={45} cy={128.4} rx={0.9} ry={0.75} fill={skin.nail} />
        </>
      )}
      <path d="M42 118 C41.6 121.3 42.8 124.2 45 124.2 C47.2 124.2 48.4 121.3 48 118 Z" fill={url('limb')} />
      <path d="M42.8 121.2 C43.8 121.7 46.2 121.7 47.2 121.2" fill="none" stroke={skin.line} strokeWidth={0.6} strokeLinecap="round" />
      {kind === 'fist' && <ellipse cx={47.2} cy={119.6} rx={1.2} ry={2} fill={skin.soft} transform="rotate(-30 47.2 119.6)" />}
    </>
  )
}

// Lupa saindo da mão fechada, na direção do antebraço: cabo e a lente depois dele.
function Lens() {
  return (
    <>
      <rect x={44} y={122.5} width={2} height={8} rx={1} fill="#4a2c17" />
      <circle cx={45} cy={136} r={5.6} fill="#cdeeff" fillOpacity={0.35} stroke="#3a3d45" strokeWidth={1.6} />
      <path d="M42 133.4 C42.8 132.2 44 131.6 45.4 131.6" fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" opacity={0.8} />
    </>
  )
}

// Notebook na frente da barriga, visto por trás da tampa: as mãos ficam no teclado, na beirada.
function Laptop() {
  return (
    <g>
      <rect x={46} y={99} width={28} height={17.5} rx={1.6} fill="#c9ccd3" stroke="#9a9ea8" strokeWidth={0.8} />
      <circle cx={60} cy={107.6} r={2.2} fill="#eef0f4" />
      <rect x={43} y={116} width={34} height={3.2} rx={1} fill="#aeb2bb" />
    </g>
  )
}

// Luva de boxe por cima da mão fechada: punho branco, luva vermelha e o polegar do lado de dentro.
function Glove() {
  const { url } = useFigure()
  return (
    <>
      <path d="M49.4 118.4 C52.4 117.8 53.6 121 51.8 123.2 L49.8 122.6 Z" fill={url('glove')} />
      <path d="M39.4 121.6 C39.4 116.8 42 115 45.4 115 C49 115 51 117.2 51 121.8 C51 126 48.4 128.4 45.2 128.4 C41.8 128.4 39.4 126 39.4 121.6 Z" fill={url('glove')} />
      <path d="M42.4 125.4 C44 126.6 46.6 126.6 48.2 125.4" fill="none" stroke="#8f1d17" strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
      <ellipse cx={43.4} cy={119.4} rx={1.6} ry={2.6} fill="#fff" opacity={0.25} />
      <rect x={40.8} y={112.4} width={8.4} height={3.6} rx={1.2} fill="#f1efea" />
    </>
  )
}

// ---------- de perfil (andando) ----------
// Virado para a direita; andando para a esquerda, o quadro inteiro espelha. A perna e o braço do
// lado de lá ficam atrás e mais escuros (.m-far). Ombro em (60, 95), cotovelo (60, 107), quadril (60, 121).
// O formato do rosto e dos olhos não muda o perfil.

// Crânio fundo (atrás em x 25, testa em 89.6): de perfil a cabeça fica tão grande quanto de frente.
// Embaixo, atrás, o crânio fecha e a nuca entra e desce reta até a gola.
const SIDE_FACE =
  'M51.6 94 L50.6 86 C49.8 81.6 47.6 79 43.4 77.4 C33 73.4 25 66 25 52 C25 26 41 10.5 61 10.5 C78.5 10.5 89.2 22 89.6 37.5 C89.8 42 89.4 45.2 89 47.6 ' +
  'L94.4 59.4 C95.3 61.3 94.3 63.4 92 63.6 L90.2 63.9 C90.4 65.6 90.6 67.2 90.8 68.8 C91.2 70.4 90.7 71.9 89.9 72.5 ' +
  'C90.5 73.5 90.4 74.9 89.7 75.9 C89.6 77 89.9 78.2 90 79.4 C90 85.2 86.6 89.4 80.8 90.8 C74 92.4 63.5 91.6 56 90.4 Z'
const SIDE_BEARD =
  'M60.6 46 C59.6 55 60.6 65 64 75 C67 83.6 72.4 89.6 80.4 90.6 C86 89.8 89.4 85 89.6 78.6 C88.2 78 87 77 86.4 75.6 ' +
  'C84.2 77.6 80 77.6 76.2 74.6 C71.6 70.6 68.6 64.4 66.6 57.4 C65.6 53.4 65 49.6 64.6 46 Z'
const SIDE_GOATEE = 'M84.6 78.4 C84.6 84 86.4 88.4 89.2 88.8 C90.6 85.6 90.6 81.6 90 78.8 C88.2 79.6 86.4 79.4 84.6 78.4 Z'
const SIDE_MUSTACHE_LIGHT = 'M85.4 67.4 C87.4 67.2 89 67.6 90 68.6 C88.6 69.6 86.6 69.8 85.2 69 Z'
const SIDE_MUSTACHE = 'M84.6 67.4 C87.2 66.4 89.8 67 91 68.8 C89.2 70.2 86.4 70.4 84.4 69.4 Z'
const SIDE_PENCIL = 'M86 68.6 C87.6 68.2 89.2 68.4 90.2 69 C89 69.6 87.4 69.6 86 69.2 Z'
const SIDE_HANDLEBAR =
  'M84.4 67.2 C87.2 66.2 90 66.8 91.2 68.8 C90 70.4 87 70.6 84.6 69.6 C83.4 70.8 81.8 71.6 80.6 70.8 C80 70.2 80.4 69.2 81.4 69.2 ' +
  'C81.4 69.8 82.2 70 83 69.4 Z'
const SIDE_SOUL_PATCH = 'M88 76.8 C88.4 78.4 89 79.4 89.8 79.6 C90.2 78.6 90.2 77.4 89.9 76.6 Z'
const SIDE_CHINSTRAP = 'M57 62 C59 72 64 82 72 88 C77 91 83 91 88.6 88'
const SIDE_CHOPS =
  'M60.6 46 C59.6 55 60.6 65 64 75 C66 80.6 69 84.6 72.6 87 C74 82 74.4 76 72.4 70 C70 64 67.4 56 66.6 52 C65.8 49 65 47 64.6 46 Z'
const SIDE_LONG_BEARD = 'M66 86 C68 96 74 104 82 106 C86 100 89 92 89.6 84 C86 89 78 91 70 89 Z'
const SIDE_EYE_WHITE = 'M77 49.9 C78.4 47.6 81.6 47.3 83.2 49.4 C81.8 51.3 78.8 51.6 77 49.9 Z'
const SIDE_SHIRT_MALE =
  'M52.4 92 C55.6 89.4 63.4 89 67.8 91.6 C70.8 93.4 71.8 97.4 71.6 101.4 C71.4 107 70.8 112.6 70.2 118 L69.9 123.6 ' +
  'C69.8 125.2 68.9 126 67.7 126 L52.6 126 C51.4 126 50.6 125.2 50.5 123.8 L50 118 C49.4 112 48.9 106 48.8 100.4 ' +
  'C48.7 96.2 49.8 93.4 52.4 92 Z'
// De lado, o busto na frente, a cintura entrando e o quadril saindo para trás.
const SIDE_SHIRT_FEMALE =
  'M52.4 92 C55.6 89.4 63.4 89 67.8 91.6 C71.2 93.4 73.8 97 74 100.8 C74.1 103.8 72.2 106.4 70.4 109 C69.8 112 70.2 115 70.6 118.4 ' +
  'L70.3 123.6 C70.2 125.2 69.3 126 68.1 126 L51.6 126 C50.2 126 49.2 125.2 49 123.6 L48.6 119.6 C48.4 116 49.6 112.4 50.6 109 ' +
  'C49.6 106 48.8 103 48.8 100.4 C48.7 96.2 49.8 93.4 52.4 92 Z'
// Barriga de lado: para a frente.
const SIDE_BELLY = { cx: 66, cy: 112.6, rx: 8.4, ry: 11 }
// Laterais curtas de perfil: clareando da nuca até a orelha.
const SIDE_FADE =
  'M36.4 76.4 C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 L61.6 41.6 C52.4 44.2 46.2 50.4 44.4 58.6 C43.4 64.6 42.6 71.8 41.2 78.4 Z'

const SIDE_BUZZ =
  'M87 28.4 C89.4 22 88 14.6 82 10.4 C75.6 6.6 67.6 6.4 60 7 C42 7.8 24.6 19 24 42 C23.7 55 26.8 67 36.4 75.4 ' +
  'C38.2 71 38.6 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 78.6 31.4 87 28.4 Z'
const SIDE_PULLED =
  'M87.4 28 C89.8 21.6 88.4 14 82.2 9.8 C75.8 6 67.8 5.8 60 6.4 C42 7.2 25 18.6 24.2 42 C23.9 55 27 67 36.4 75.6 ' +
  'C38.2 71 38.6 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 78.8 31 87.4 28 Z'
const SIDE_PULLED_STRANDS = ['M84 25 C78 16 66 11 50 11', 'M76 30 C68 21 56 16 40 17', 'M62 35 C54 28 44 25 32 27']
const SIDE_QUIFF_STRANDS = [
  'M84.6 24 C83 16.4 77 11 68.4 9',
  'M78.6 28.6 C74.6 20.6 66.6 15.4 56 13.4',
  'M70.6 31.6 C64.6 24.6 54.6 20 44 19.4',
  'M61 35 C53 30.2 42.6 28.4 33.4 30.6'
]
// Até o queixo, cobrindo a orelha, com a franja na testa (chanel e o começo do ondulado).
const SIDE_LONG_TOP = 'M90 31.4 C93.6 22.6 90.6 11.6 81.6 6.6 C73.6 2.2 64.6 2.4 57.6 3 C37.6 4.6 21.4 18.6 21.4 44'
const SIDE_LONG_FRONT = 'C55.6 49.6 60.6 42 70 37.4 C76.4 34.4 83.4 33 90 31.4 Z'
const SIDE_SHINE = 'M50 9 Q64 5 79 8.4 Q66 9 54 12.6 Z'
const SIDE_SHINE_LOW = 'M52 10 Q65 6.6 78 9.6 Q66 10 55 13 Z'
const SIDE_SHINE_LONG = 'M50 6.6 Q66 3 82 8 Q66 7.6 54 10.6 Z'

// Cabelo de perfil, nos mesmos campos do de frente.
// Os ondulados novos usam o perfil do cabelo mais parecido, com as mechas em ondas.
type SideOnly = 'wavyBob' | 'curtainWaves' | 'beachWaves' | 'longCurly'
const HAIR_SIDE: Record<Exclude<HairStyle, SideOnly>, HairArt> = {
  quiff: {
    front:
      'M87.6 27 C90.6 21 90 13.4 84 9 C77 4.2 68 4.4 60 5.2 C41 6 23.6 18 23 42 C22.7 55.5 26 68 36.4 76.4 ' +
      'C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 79 30.6 87.6 27 Z',
    strands: SIDE_QUIFF_STRANDS,
    shine: SIDE_SHINE,
    fade: true
  },
  buzz: { front: SIDE_BUZZ, opacity: 0.88, strands: [], shine: SIDE_SHINE_LOW, fade: true },
  bald: { front: SIDE_BUZZ, opacity: 0.14, strands: [], shine: 'M48 14 Q64 9.6 80 14 Q64 13.6 52 18 Z' },
  undercut: {
    under: SIDE_BUZZ,
    front:
      'M88 27.4 C91 21 90 13 84 8.6 C77 3.8 68 4 60 4.8 C49 5.4 39 10 33 18 C37 20 44 22 50 26 C54 29 57 32.6 59.6 36.6 ' +
      'C69.6 34 79 30.8 88 27.4 Z',
    strands: SIDE_QUIFF_STRANDS.slice(0, 3),
    shine: SIDE_SHINE
  },
  mohawk: {
    under: SIDE_BUZZ,
    front:
      'M87 22 C89 13 85 3 76 -2.6 C68 -7 57 -7.4 47 -4 C37 -0.4 29 7 25 17 L23.4 24 C27 20 31 16.6 36 14 C45 9.6 56 8 66 9 ' +
      'C75 10 82 15 87 22 Z',
    strands: ['M80 6 C72 -1 60 -3 48 -1', 'M84 14 C76 6 62 3 46 5'],
    shine: 'M52 -3 Q66 -6 78 -1 Q66 -3.4 55 0 Z'
  },
  spiky: {
    front:
      'M87.6 27 C90.6 21 92 14 94 8 L84 9 L86 0 L76 5 L74 -4 L66 3 L60 -5 L56 3 L46 -2 L45 7 L36 4 L37 12 L27 13 ' +
      'C24 22 23 32 23 42 C22.7 55.5 26 68 36.4 76.4 C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 79 30.6 87.6 27 Z',
    strands: ['M80 20 L84 11', 'M70 18 L74 4', 'M58 16 L60 0', 'M46 18 L46 4', 'M36 22 L33 13'],
    shine: SIDE_SHINE,
    fade: true
  },
  sidePart: {
    front:
      'M88.4 28 C90.6 22 89 14 83 10 C76 5.6 68 5.6 60 6 C41 6.8 24 18.4 23.4 42 C23.1 55.5 26 68 36.4 76.4 ' +
      'C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C70 34 80 31 88.4 28 Z',
    strands: ['M86 22 C78 13 66 10 52 11', 'M80 28 C70 20 56 17 40 20', 'M68 33 C58 27 46 26 32 30'],
    shine: SIDE_SHINE,
    fade: true
  },
  curly: {
    front:
      'M90.6 30 C95.4 22 93.6 10 84.6 4.6 C76.6 0 66 -0.8 57 0 C36 2 19 17 19 42 C19 57 23.6 69 33.4 77.4 ' +
      'C37.4 73 38.4 65 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C70.4 33.8 80.6 32.6 90.6 30 Z',
    strands: [],
    bumps: [
      [22.6, 30, 5.6],
      [27.6, 18.6, 6.2],
      [37.6, 9.4, 6.6],
      [50, 3.4, 6.8],
      [63, 1.4, 6.8],
      [76, 2.8, 6.4],
      [86, 8.6, 6],
      [92, 18.4, 5.4],
      [20.6, 44, 5.2],
      [22.6, 57.6, 5],
      [28, 69.6, 4.6],
      [88.6, 30.4, 3.4],
      [81, 32.4, 3.4],
      [73.4, 34.2, 3.4],
      [65.8, 36, 3.4]
    ],
    curls: [
      [40, 20],
      [52, 14],
      [64, 12],
      [76, 15],
      [30, 34],
      [30, 50],
      [44, 28],
      [58, 24],
      [72, 24],
      [84, 22]
    ],
    fade: true
  },
  // A bola fica atrás do rosto; por cima, só a camada da cabeça, para a linha da testa.
  afro: {
    back: 'M15 28 A39 37 0 1 0 93 28 A39 37 0 1 0 15 28 Z',
    backBumps: ring(54, 28, 38, 36, 5.4, 20),
    front: SIDE_BUZZ,
    strands: [],
    curls: [
      [30, 2],
      [44, -4],
      [58, -5],
      [72, -2],
      [84, 6],
      [22, 16],
      [18, 32],
      [20, 48],
      [28, 60],
      [36, 14],
      [50, 10],
      [66, 10],
      [30, 30]
    ]
  },
  bob: {
    front:
      `${SIDE_LONG_TOP} C21.4 60 22.6 73.6 25.4 84.6 C26 87 28 88 30.4 87.4 L52.6 84.4 C55.4 84 56.6 82.4 55.8 80 ` +
      `C54.4 74 54 67 54.6 60 ${SIDE_LONG_FRONT}`,
    strands: ['M86 18 C76 10 62 8 46 12', 'M88 28 C78 20 62 18 44 24', 'M40 20 C30 34 26 56 28 80', 'M50 30 C42 44 40 64 42 84'],
    shine: SIDE_SHINE_LONG
  },
  wavy: {
    front:
      `${SIDE_LONG_TOP} C19 54 23 62 21 70 C19 78 24 86 23 94 C24 97 27 98 30 97.4 L48 94 C51 93.4 52 91 51 88 ` +
      `C50 84 51.6 80 53.6 73.6 C54.6 68 54.8 63 55 58 ${SIDE_LONG_FRONT}`,
    strands: [
      'M86 18 C76 10 62 8 46 12',
      'M88 28 C78 20 62 18 44 24',
      'M38 20 C28 34 30 44 26 56 C23 66 28 76 26 88',
      'M48 30 C42 42 44 52 41 62 C39 72 44 80 42 90'
    ],
    shine: SIDE_SHINE_LONG
  },
  // Desce pelas costas, encostando nelas.
  long: {
    front:
      `${SIDE_LONG_TOP} C21.4 64 24.4 80 30.6 92.4 C33.6 98.4 37 103.4 40.4 107 C42.2 108.8 45 109 47 107.4 L50.4 104.4 ` +
      `C51.6 100.6 50.6 95 50 89.6 C49.6 84 51.4 79 53.6 73.6 C54.6 68 54.8 63 55 58 ${SIDE_LONG_FRONT}`,
    strands: ['M86 18 C76 10 62 8 46 12', 'M88 28 C78 20 62 18 44 24', 'M36 18 C26 36 26 64 34 90', 'M46 28 C38 46 38 72 44 100'],
    shine: SIDE_SHINE_LONG
  },
  // O rabo sai do alto, atrás, e desce pelas costas da cabeça.
  ponytail: {
    back: 'M33.6 15 C22 17 15.4 28 15.6 44 C15.8 56 19.4 66 23.4 73 C25.6 70 25.8 62 26.6 54 C27.6 42 29.8 30 36.6 21.6 Z',
    front: SIDE_PULLED,
    strands: [...SIDE_PULLED_STRANDS, 'M28 22 C20 32 18 48 22 64'],
    shine: SIDE_SHINE_LOW,
    fade: true
  },
  // O coque fica atrás, no alto da cabeça.
  bun: {
    back: 'M21.6 13 A9.4 9.4 0 1 0 40.4 13 A9.4 9.4 0 1 0 21.6 13 Z',
    front: SIDE_PULLED,
    strands: [...SIDE_PULLED_STRANDS, 'M24 10 C27 6 33 5 37 7.6'],
    shine: SIDE_SHINE_LOW,
    fade: true
  },
  // Calvo: uma faixa de cabelo da têmpora, passando por trás, até a nuca.
  balding: {
    front:
      'M64 36.6 C54 37.2 46 41 41 47 C38 52 37 58 36.6 64 C36.4 69 36.4 72 36.4 75.6 C27 67 23.8 55 24.2 43 ' +
      'C24.4 36 26.4 30 30 25 C40 26.6 54 30.6 64 36.6 Z',
    strands: ['M58 34 C48 30 38 28.6 30 28', 'M44 40 C38 38 32 38 27 40'],
    shine: 'M48 14 Q64 9.6 80 14 Q64 13.6 52 18 Z',
    fade: true
  },
  slickBack: {
    front:
      'M88 28 C90.4 22 89.4 14 83.6 9.6 C77 5 68 5 60 5.6 C42 6.4 24.6 18 24 41 C23.7 54.4 26.6 67 36.4 75.4 ' +
      'C38.4 71 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 79 31 88 28 Z',
    strands: ['M86 24 C76 18 60 14 40 18', 'M80 29 C70 23 54 20 34 26', 'M70 33 C60 28 46 27 32 33', 'M84 14 C74 9 60 8 46 11'],
    shine: 'M50 8.4 Q66 4.6 82 9 Q66 8.4 54 12 Z',
    fade: true
  },
  pixie: {
    front:
      'M89.4 32 C92.6 24 91 13.4 84 9 C77 4.6 68 4.6 60 5.4 C42 6.4 24.4 18.4 23.8 42 C23.5 55 26.6 67 36.4 75.6 ' +
      'C38.4 71 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C70 34 80 33.6 89.4 32 Z',
    strands: ['M86 26 C80 18 70 14 58 13', 'M80 31 C72 24 60 21 46 22', 'M64 35 C56 30 46 28 34 31'],
    shine: SIDE_SHINE,
    fade: true
  },
  // Cuia de perfil: reta na altura de cima da orelha e na testa.
  bowl: {
    front:
      'M91.6 34.6 C93 24 90 12 81 6.6 C73 2.4 64 2.6 57 3.2 C38 4.8 22.4 18.6 22.4 44 L22.8 52 L47.6 52 C48.2 46 50 42 54 38.6 ' +
      'C58 36 64 34.6 70 34.6 Z',
    strands: ['M86 34 L84 22', 'M78 34.6 L76 16', 'M66 34.8 L64 12', 'M52 40 L48 16', 'M38 50 L33 24', 'M28 51 L26 32'],
    shine: SIDE_SHINE_LONG
  },
  // Mullet: o comprido sai da nuca e desce pelas costas.
  mullet: {
    back: 'M37 68 C33 78 33.6 90 37.6 100 C41 106 48 107 52.4 103 C50.6 96 49.6 90 50.4 84 C50.8 80 51.6 78 52 76 C47 76 42 73 37 68 Z',
    front:
      'M87.6 27 C90.6 21 90 13.4 84 9 C77 4.2 68 4.4 60 5.2 C41 6 23.6 18 23 42 C22.7 55.5 26 68 36.4 76.4 ' +
      'C38.4 72 38.8 64.6 39.6 58 C41.2 47.6 48.4 39.8 60 36.6 C69.6 34 79 30.6 87.6 27 Z',
    strands: [...SIDE_QUIFF_STRANDS.slice(0, 3), 'M40 80 C38 88 39 96 42 102'],
    shine: SIDE_SHINE,
    fade: true
  },
  // Dreads de perfil: cobrem a orelha e descem pelas costas da cabeça.
  dreads: {
    front:
      `${SIDE_LONG_TOP} C21.4 60 22.6 76 25 90 L48 92 C47.6 84 48.4 78 50 74 C52 66 54 60 55 56 ` + SIDE_LONG_FRONT,
    strands: ['M84 18 C76 10 64 8 50 10', 'M86 26 C76 18 62 16 46 20'],
    frontLocks: [
      'M24 44 C22 60 22.6 76 24.6 94',
      'M30 40 C28.4 58 29 78 31.6 98',
      'M37 40 C36 58 37 78 39.6 100',
      'M44 44 C43.6 60 44.4 76 46.4 96',
      'M88 30 C88.6 34 88.4 37 87.6 40'
    ],
    shine: SIDE_SHINE_LONG
  },
  // Um rabinho aparece atrás, preso com elástico.
  pigtails: {
    back: 'M33 22 C22 24 15.4 36 15.6 50 C15.8 61 19 70 23.4 76 C25.6 70 25.8 62 26.8 54 C28 44 30.6 34 36 28 Z',
    front: SIDE_PULLED,
    strands: [...SIDE_PULLED_STRANDS, 'M27 30 C20 40 19 54 22.6 68'],
    ties: [[34.4, 25, 2.8]],
    shine: SIDE_SHINE_LOW,
    fade: true
  },
  // A trança desce pelas costas, atrás do pescoço.
  braids: {
    back: 'M32 111.4 C31.4 115.4 32.8 118.4 34.6 119.4 C36.4 118.4 37.8 115.4 37.2 111.4 Z',
    backBumps: braid(31, 30, 34.6, 104, 11, 4.4),
    braid: true,
    front: SIDE_PULLED,
    strands: SIDE_PULLED_STRANDS,
    ties: [[34.6, 109.6, 2.6]],
    shine: SIDE_SHINE_LOW,
    fade: true
  }
}

function SideView({ pose }: { pose: Pose }) {
  const { url, female, build, look } = useFigure()
  const hadouken = pose === 'hadouken'
  const skirt = look.bottom === 'skirt'
  const body = widen(60, build.torso)
  const leg = (move: string) => (
    <Pivot x={60} y={121} move={move}>
      <g transform={widen(60, build.leg)}>
        <SideLeg />
      </g>
    </Pivot>
  )
  return (
    <>
      <g className="m-far">
        <SideArm side="far" charge={hadouken} />
        {leg('m-leg-far-move')}
      </g>
      {!skirt && (
        <path
          d={
            female
              ? 'M49.4 118 L70 118 L70.2 126.8 C66.2 128.4 62.6 129 59.4 129 C55.6 129 52.2 128.4 49 127.4 Z'
              : 'M50.6 118 L69.6 118 L69.8 126.8 C66 128.4 62.6 129 59.4 129 C56 129 53 128.4 50.4 127.6 Z'
          }
          transform={body}
          fill={url('jeans')}
        />
      )}
      {leg('m-leg-near-move')}
      <g transform={body}>
        {skirt && <SideSkirt />}
        <SideTorso />
      </g>
      {look.accessories.includes('necklace') && <Necklace side />}
      <Pivot x={60} y={90} move="m-head-move">
        <g transform={headTransform(1)}>
          <SideHead />
        </g>
      </Pivot>
      <SideArm side="near" charge={hadouken} />
    </>
  )
}

function sideHair(style: HairStyle): HairArt {
  const wavy = (base: HairArt, strands: string[], extra?: Partial<HairArt>): HairArt => ({ ...base, strands: [...base.strands.slice(0, 2), ...strands], ...extra })
  switch (style) {
    case 'wavyBob':
      return wavy(HAIR_SIDE.bob, [wavyStrand(40, 22, 28, 80, 2, 4), wavyStrand(50, 32, 42, 82, 2, 4)])
    case 'curtainWaves':
      return HAIR_SIDE.wavy
    case 'beachWaves':
      return wavy(HAIR_SIDE.long, [wavyStrand(36, 20, 34, 90, 2.4, 6), wavyStrand(46, 30, 44, 100, 2.4, 6)])
    case 'longCurly':
      return wavy(HAIR_SIDE.long, [], {
        curls: [
          [44, 12],
          [60, 9],
          [74, 12],
          [34, 30],
          [30, 50],
          [32, 70],
          [38, 88],
          [44, 100],
          [46, 40],
          [44, 62]
        ]
      })
    default:
      return HAIR_SIDE[style]
  }
}

function SideHead() {
  const f = useFigure()
  const { url, skin, hair, beard } = f
  const art = sideHair(f.look.hair)
  const style = f.look.beard
  return (
    <>
      {art.back && <path d={art.back} fill={url('hair')} />}
      {art.backBumps?.map(([cx, cy, r]) => (
        <circle
          key={`${cx} ${cy}`}
          cx={cx}
          cy={cy}
          r={r}
          fill={url('hair')}
          stroke={art.braid ? hair.bottom : undefined}
          strokeWidth={art.braid ? 0.8 : undefined}
        />
      ))}
      <path d={SIDE_FACE} fill={url('skin')} />
      {art.fade && <path d={SIDE_FADE} fill={url('fade')} />}
      <Hair art={art} />
      {!COVERS_EARS[f.look.hair] && (
        <>
          <path
            d="M57.6 46.6 C53 44.6 49.4 47.8 49.6 53.4 C49.8 58.8 52.4 62.6 56.6 62.4 C58.6 62.2 59.2 60 58.4 57.8 C59.8 54 59.6 49 57.6 46.6 Z"
            fill={url('skin')}
            stroke={skin.line}
            strokeWidth={0.6}
          />
          <g fill="none" stroke={skin.line} strokeLinecap="round">
            <path d="M55.6 49.6 C52.8 50.2 52.4 54.6 54 57.6" strokeWidth={1.1} />
            <path d="M55 52.4 C56.2 53 56.4 54.8 55.4 55.8" strokeWidth={0.9} />
          </g>
        </>
      )}
      <ellipse cx={78} cy={59} rx={4.5} ry={2.6} fill="#e88f78" opacity={f.female ? 0.26 : 0.16} />
      <path
        d={
          f.female
            ? 'M75.4 41.8 C78.6 39.4 83 39 86.4 40.6 C86.9 41.2 86.6 41.9 86 42 C82.8 41.3 79 41.8 76.2 43.4 C75.4 43.8 74.9 42.4 75.4 41.8 Z'
            : 'M75 41.6 C78.4 39.6 83 39.4 86.4 40.8 C87 41.6 86.6 42.6 85.8 42.7 C82.6 42 78.8 42.4 75.8 43.8 C75 44.2 74.4 42.4 75 41.6 Z'
        }
        fill={hair.brow}
      />
      <SideEye />
      <path d="M77.6 46.6 C79.4 45.2 82 45.1 83.4 46.2" fill="none" stroke={skin.line} strokeWidth={0.8} strokeLinecap="round" opacity={0.7} />
      {/* Nariz: o contorno já está no rosto; aqui a narina e o brilho. */}
      <path d="M89.8 49.4 L93.2 58.4" stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.25} />
      <ellipse cx={90.4} cy={62.2} rx={1.5} ry={0.75} fill={skin.nostril} opacity={0.6} transform="rotate(-15 90.4 62.2)" />
      {(style === 'stubble' || style === 'full' || style === 'long') && (
        <>
          <path d={SIDE_BEARD} fill={url(style === 'stubble' ? 'beard' : 'beard-full')} filter={url('soft')} />
          <path d={SIDE_BEARD} fill={url('beard-texture')} opacity={style === 'stubble' ? 0.16 : 0.35} />
          <ellipse cx={86.6} cy={80.6} rx={2.6} ry={2.4} fill={beard.beard} opacity={0.2} filter={url('soft')} />
        </>
      )}
      {style === 'long' && <path d={SIDE_LONG_BEARD} fill={beard.beard} opacity={0.92} />}
      {style === 'goatee' && <path d={SIDE_GOATEE} fill={beard.beard} opacity={0.9} />}
      {style === 'soulPatch' && <path d={SIDE_SOUL_PATCH} fill={beard.beard} opacity={0.9} />}
      {style === 'muttonChops' && <path d={SIDE_CHOPS} fill={beard.beard} opacity={0.85} filter={url('soft')} />}
      {style === 'chinstrap' && <path d={SIDE_CHINSTRAP} fill="none" stroke={beard.beard} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />}
      <path
        d="M89.6 69 C90.6 70.2 90.8 71.6 89.8 72.5 C90.4 73.5 90.2 75 89.4 75.7 C88.2 75.5 87.3 74.4 87.1 73 C87.1 71.4 87.9 69.8 89.6 69 Z"
        fill={url('lip')}
      />
      <path d="M89.6 72.6 C88.2 72.9 86.8 72.8 85.6 72.2" fill="none" stroke={skin.lipLine} strokeWidth={0.9} strokeLinecap="round" />
      {/* De perfil, só a língua e os dentões mudam a boca; os outros estilos ficam com a de sempre. */}
      {f.look.mouth === 'tongue' && <path d="M88.2 72.8 C89.8 73 91.2 74.4 90.8 75.8 C90.2 76.8 88.8 76.4 88 75 Z" fill={TONGUE_FILL} />}
      {f.look.mouth === 'buck' && <path d="M88.6 72.7 L90.2 72.9 L90 74.9 L88.8 74.7 Z" fill={TOOTH_FILL} stroke="#d6cfc4" strokeWidth={0.3} />}
      {style === 'stubble' && <path d={SIDE_MUSTACHE_LIGHT} fill={beard.beard} opacity={0.45} filter={url('soft')} />}
      {THICK_MUSTACHE.includes(style) && <path d={SIDE_MUSTACHE} fill={beard.beard} opacity={0.92} />}
      {style === 'pencil' && <path d={SIDE_PENCIL} fill={beard.beard} opacity={0.95} />}
      {style === 'handlebar' && <path d={SIDE_HANDLEBAR} fill={beard.beard} opacity={0.95} />}
      <SideHeadAccessories />
    </>
  )
}

// Acessórios da cabeça de perfil: a lente na frente do olho (80, 49.6) com a haste até a orelha, o
// boné com a aba para a frente, o gorro, o laço atrás e o brinco na orelha.
function SideHeadAccessories() {
  const has = useAccessory()
  const eyewear = (['glasses', 'aviators', 'sunglasses'] as const).find(has)
  return (
    <>
      {has('earrings') && <circle cx={55.8} cy={64.8} r={2.4} fill="none" stroke={GOLD} strokeWidth={1.1} />}
      {eyewear && (
        <>
          <path d="M79 47.4 L57 49" stroke={eyewear === 'aviators' ? GOLD : FRAME} strokeWidth={1.2} strokeLinecap="round" />
          {eyewear === 'glasses' && <rect x={78.6} y={44} width={8.4} height={11.2} rx={3} fill="#fff" fillOpacity={0.12} stroke={FRAME} strokeWidth={1.4} />}
          {eyewear === 'aviators' && (
            <path d="M78.6 44.6 C78.6 43.4 80 43 83 43 C86 43 87.4 43.6 87.2 45.6 C86.8 51 85.2 55.6 82.8 55.6 C80.2 55.6 78.8 51 78.6 44.6 Z" fill="#2c3e52" fillOpacity={0.82} stroke={GOLD} strokeWidth={1.1} />
          )}
          {eyewear === 'sunglasses' && (
            <path d="M78.2 44 L87.6 44 L87.2 50.6 C86.8 54 85.4 55.8 83.4 55.8 L82 55.8 C80 55.8 78.6 54 78.4 50.6 Z" fill="#16171b" stroke={FRAME} strokeWidth={1.2} strokeLinejoin="round" />
          )}
        </>
      )}
      {has('cap') && (
        <>
          <path d="M24 36 C22 16 38 4 58 4 C76 4 90 14 92 32 C74 30 44 31 24 36 Z" fill={CAP.mid} />
          <path d="M58 4.6 C66 12 72 22 74 31 M42 8 C38 16 36 26 37 33.4" fill="none" stroke={CAP.dark} strokeWidth={0.8} opacity={0.6} />
          <path d="M86 30.6 C94 29.8 104 31.2 108.4 34.4 C100.4 36.2 92 36.2 85.6 35.2 Z" fill={CAP.dark} />
        </>
      )}
      {has('beanie') && (
        <>
          <path d="M24 38 C22 16 38 3 58 3 C76 3 90 14 92 36 Z" fill={BEANIE.mid} />
          <path d="M23 30.4 C44 26.4 74 25.6 92.6 28.6 L92.8 37.6 C74 35 44 35.6 23.6 39.6 Z" fill={BEANIE.dark} />
          <circle cx={56} cy={1.6} r={5.2} fill={BEANIE.light} />
        </>
      )}
      {has('bow') && (
        <g stroke="#b8344f" strokeWidth={0.6} strokeLinejoin="round">
          <path d="M38 12 C32 5 25 7 27 12.4 C25 18 32 19 38 12 Z" fill={TIE_COLOR} />
          <path d="M38 12 C44 5 51 7 49 12.4 C51 18 44 19 38 12 Z" fill={TIE_COLOR} />
          <circle cx={38} cy={12} r={2.4} fill="#d9476a" />
        </g>
      )}
    </>
  )
}

// Olho de perfil. Sorrindo, fechado em arco; bolinha, só a bolinha escura; os outros formatos não
// mudam de lado (a piscadinha fecha o olho de lá).
function SideEye() {
  const { url, look, female } = useFigure()
  const color = eyePalette(look.eyeColor)
  const kind = EYES[look.eyes].kind
  if (kind === 'closed') {
    return <path d="M76.6 50 C78.4 47.4 82 47.2 83.6 49.6" fill="none" stroke="#2e2018" strokeWidth={1.4} strokeLinecap="round" />
  }
  if (kind === 'dot') {
    return (
      <Pivot x={80.2} y={49.6} move="m-blink">
        <ellipse cx={80.6} cy={49.6} rx={1.7} ry={2.2} fill={mix(color.ring, '#000000', 0.35)} />
        <circle cx={81.2} cy={48.8} r={0.55} fill="#fff" />
      </Pivot>
    )
  }
  return (
    <Pivot x={80.2} y={49.6} move="m-blink">
      <path d={SIDE_EYE_WHITE} fill="#fbf6f1" />
      <g clipPath={url('eye-side')}>
        <circle cx={81.4} cy={49.5} r={2.1} fill={color.fill} stroke={color.ring} strokeWidth={0.6} />
        <circle cx={81.4} cy={49.5} r={1} fill="#17100b" />
        <circle cx={82} cy={48.8} r={0.5} fill="#fff" />
      </g>
      <g fill="none" strokeLinecap="round">
        <path d="M76.4 49.8 C78 46.8 82 46.5 83.8 49.2" stroke="#2e2018" strokeWidth={1.4} />
        <path d="M76.6 49.6 L75.2 48.7" stroke="#2e2018" strokeWidth={0.9} />
        {female && (
          <g stroke="#2e2018" strokeWidth={0.8}>
            <path d="M83.4 48.6 L85.6 47.2" />
            <path d="M82.4 47.4 L84 45.6" />
          </g>
        )}
      </g>
    </Pivot>
  )
}

// Braço de perfil: balança para a frente e para trás; o antebraço fica um pouco dobrado para a frente.
// charge: a bolinha de energia na mão, enquanto o hadouken carrega.
function SideArm({ side, charge }: { side: 'near' | 'far'; charge?: boolean }) {
  const { url, skin, build } = useFigure()
  const thick = widen(60, build.arm)
  return (
    <Pivot x={60} y={95} move={`m-arm-${side}-move`}>
      <Pivot x={60} y={107} pose={`m-fore-${side}`}>
        <g transform={thick}>
          {/* Antebraço e manga: os de frente, deslocados para o eixo do perfil. */}
          <g transform="translate(15 0)">
            <Forearm wrist={side === 'near' ? 'watch' : 'bracelet'} />
          </g>
          <path d="M57 117.8 C56.2 121 57 124.8 60 125.2 C63 124.8 63.8 121 63 117.8 Z" fill={url('limb')} />
          <ellipse cx={62.6} cy={119.6} rx={1.1} ry={2.2} fill={skin.soft} transform="rotate(-20 62.6 119.6)" />
        </g>
        {charge && side === 'near' && (
          <Pivot x={61} y={124} move="m-charge">
            <circle cx={61} cy={124} r={6} fill={url('energy')} />
            <circle cx={61} cy={124} r={2.2} fill="#f4fdff" />
          </Pivot>
        )}
      </Pivot>
      <g transform={`${thick ?? ''} translate(15 0)`}>
        <UpperArm />
      </g>
    </Pivot>
  )
}

function SideSneaker() {
  return (
    <>
      <path
        d="M56 139 L62.6 139 C65.8 139 68.6 140.8 69.8 143.2 C70.4 144.8 69.6 147 67.8 147 L56.8 147 C55.8 147 55.2 146.2 55.2 145.2 L55.2 140.6 C55.2 139.6 55.6 139 56 139 Z"
        fill="#2b2d34"
      />
      <path d="M58 140.6 Q61.5 139.8 65 140.8" fill="none" stroke="#4a4d56" strokeWidth={0.7} />
      <rect x={55.2} y={145.4} width={14.8} height={1.6} rx={0.8} fill="#e6e6e6" />
    </>
  )
}

// Perna de perfil, com o bico do tênis para a frente: como a de frente (calça, bermuda, shorts ou a
// perna aparecendo na saia), com a coxa feminina mais cheia.
const SIDE_LEG = {
  male: {
    pants: 'M56.3 120 L63.7 120 L63.3 140.6 C63.2 142 62.5 142.8 61.3 142.8 L58.7 142.8 C57.5 142.8 56.8 142 56.7 140.6 Z',
    skin: 'M56.8 120 L63.2 120 C63.2 126 63 133 62.8 140 L57.2 140 C57 133 56.8 126 56.8 120 Z',
    bermuda: 'M55.8 119 L64.2 119 L64 135 C61.4 135.7 58.6 135.7 56 135 Z',
    shorts: 'M55.8 119 L64.2 119 L64.6 128 C61.6 128.8 58.4 128.8 55.4 128 Z',
    seam: 'M58.2 124 L58.4 139'
  },
  female: {
    pants: 'M55.6 120 L64.2 120 C64.2 126 63.2 133 62.8 139 L62.6 141 C62.5 142.2 62 142.8 61 142.8 L59 142.8 C58 142.8 57.5 142.2 57.4 141 L57.2 139 C56.8 133 55.6 126 55.6 120 Z',
    skin: 'M56.2 120 L63.6 120 C63.6 126 62.9 132.6 62.4 140 L57.8 140 C57.3 132.6 56.2 126 56.2 120 Z',
    bermuda: 'M55.2 119 L64.6 119 C64.6 124 64.2 129 63.8 134 C61.2 134.7 58.6 134.7 56.2 134 C55.8 129 55.2 124 55.2 119 Z',
    shorts: 'M55 119 L64.8 119 L64.6 127 C61.4 127.8 58.4 127.8 55 127 Z',
    seam: 'M58.4 124 C58.6 129 58.8 134 59 139'
  }
}

function SideLeg() {
  const { url, skin, bottom, female, look } = useFigure()
  const leg = female ? SIDE_LEG.female : SIDE_LEG.male
  const kind = look.bottom
  return (
    <>
      {kind === 'pants' ? (
        <>
          <path d={leg.pants} fill={url('jeans')} />
          <path d={leg.seam} fill="none" stroke={bottom.fold} strokeWidth={0.7} opacity={0.6} />
        </>
      ) : (
        <>
          <path d={leg.skin} fill={url('limb')} />
          <path d="M62.4 130.4 Q63.4 131.8 62.6 133.2" fill="none" stroke={skin.line} strokeWidth={0.6} strokeLinecap="round" opacity={0.45} />
          {kind !== 'skirt' && (
            <>
              <path d={leg[kind]} fill={url('jeans')} />
              <path d={leg[kind]} fill="none" stroke={bottom.collar} strokeWidth={0.6} opacity={0.5} />
            </>
          )}
        </>
      )}
      <SideSneaker />
    </>
  )
}

const SIDE_SKIRT =
  'M50.2 117.6 L70 117.6 C72.2 123 74.2 128.6 75.2 133.6 C68.2 135.4 62.2 135.8 57.2 135.6 C52.2 135.4 47.6 134.6 45 133.6 C46.4 128.6 48.2 123 50.2 117.6 Z'

function SideSkirt() {
  const { url, bottom } = useFigure()
  return (
    <>
      <path d={SIDE_SKIRT} fill={url('jeans')} />
      <g stroke={bottom.fold} strokeWidth={0.8} strokeLinecap="round" opacity={0.55}>
        <path d="M55.4 121 L53.2 135.2" />
        <path d="M62.6 121 L64.2 135.4" />
        <path d="M68.6 121 L71.4 134.6" />
      </g>
      <path d="M45.6 133.2 C55 136 66 136 74.6 133.2" fill="none" stroke={bottom.collar} strokeWidth={1.1} strokeLinecap="round" opacity={0.7} />
    </>
  )
}

// Tronco de perfil com a roupa de cima, recortada pelo contorno como a de frente.
function SideTorso() {
  const { url, look, female, build, top, inner } = useFigure()
  const outline = female ? SIDE_SHIRT_FEMALE : SIDE_SHIRT_MALE
  const base = (fill: string) => (
    <>
      <path d={outline} fill={fill} />
      {build.belly && <ellipse {...SIDE_BELLY} fill={fill} />}
    </>
  )
  const hem = <path d={female ? 'M49.4 123.4 L70.2 123.4' : 'M50.8 123.4 L69.8 123.4'} stroke={top.hem} strokeWidth={1} opacity={0.5} />
  const bust = female && <ellipse cx={70.4} cy={100.4} rx={3.2} ry={3} fill="#fff" opacity={0.12} />
  const shade = <ellipse cx={66} cy={97} rx={5} ry={3} fill="#000" opacity={0.12} />
  switch (look.top) {
    case 'tank':
      return (
        <>
          {base(url('limb'))}
          <g clipPath={url('side-torso')}>
            <path d="M40 97.6 C50 95.6 58 96.4 63 97.6 C66 98.4 69.4 98 74 96 L82 96 L82 132 L40 132 Z" fill={url('shirt')} />
          </g>
          <path d="M63 97.6 C66 98.4 69.4 98 72.6 96.6" fill="none" stroke={top.collar} strokeWidth={1.2} strokeLinecap="round" />
          {bust}
          {hem}
        </>
      )
    case 'blouse':
      return (
        <>
          {base(url('shirt'))}
          {bust}
          <path d="M61.6 90.4 C64.4 92.8 67 95.4 69.8 96.6 L70.8 93 C68.6 91.6 65.8 90.8 61.6 90.4 Z" fill={url('limb')} />
          <path d="M61.6 90.4 C64.4 92.8 67 95.4 69.8 96.6" fill="none" stroke={top.collar} strokeWidth={1.8} strokeLinecap="round" />
          <g clipPath={url('side-torso')}>
            <path d="M40 108.8 L82 108.8 L82 111.6 L40 111.6 Z" fill={top.collar} opacity={0.85} />
          </g>
          {hem}
        </>
      )
    case 'shirt':
      return (
        <>
          {base(url('shirt'))}
          {bust}
          {shade}
          {[100, 107, 114, 121].map((y) => (
            <circle key={y} cx={female ? 71.2 - (y - 100) * 0.02 : 70.4 - (y - 100) * 0.04} cy={y} r={0.8} fill={top.collar} />
          ))}
          <path d="M60.2 89.8 L68.6 90.8 L66.2 95.6 Z" fill={url('shirt')} stroke={top.collar} strokeWidth={0.7} strokeLinejoin="round" />
          {hem}
        </>
      )
    case 'jacket':
      return (
        <>
          {base(url('shirt'))}
          {/* A camiseta branca aparece na frente, pela jaqueta aberta. */}
          <g clipPath={url('side-torso')}>
            <path d="M66.6 91.4 C69.8 100 69.6 112 69 126 L82 126 L82 86 Z" fill={inner.mid} />
          </g>
          <path d="M66.6 91.4 C69.8 100 69.6 112 69 126" fill="none" stroke={top.collar} strokeWidth={1.4} strokeLinecap="round" />
          {hem}
        </>
      )
    default:
      return (
        <>
          {base(url('shirt'))}
          {bust}
          {shade}
          <path d="M60.5 90.4 C63 92.4 65.6 92.8 68 91.8" fill="none" stroke={top.collar} strokeWidth={2.4} strokeLinecap="round" />
          {hem}
        </>
      )
  }
}

// ---------- golpes e extras ----------

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

// Estrela do impacto, com três risquinhos saindo dela.
// Amarela (chicote, tapa, soco, chute) ou azul (hadouken).
const BURST_COLORS = { yellow: { fill: '#ffd84a', stroke: '#ff9a3c' }, blue: { fill: '#c8f4ff', stroke: '#4cc2ff' } }

function Burst({ x, y, className, color = 'yellow' }: { x: number; y: number; className: string; color?: keyof typeof BURST_COLORS }) {
  const c = BURST_COLORS[color]
  return (
    <Pivot x={x} y={y} move={className}>
      <path d={star(x, y, 8, 3.2, 6)} fill={c.fill} stroke={c.stroke} strokeWidth={0.8} strokeLinejoin="round" />
      <g stroke={c.fill} strokeWidth={1.2} strokeLinecap="round">
        <path d={`M${x + 9} ${y - 8} L${x + 11} ${y - 10}`} />
        <path d={`M${x + 10} ${y + 8} L${x + 12} ${y + 10}`} />
        <path d={`M${x} ${y - 11.5} L${x} ${y - 14}`} />
      </g>
    </Pivot>
  )
}

// Estalo do chicote (tira reta até a pasta) e depois a tira caindo. A preparação fica atrás da cabeça.
function WhipCrack() {
  const tip = STRIKES.whip.tip
  return (
    <>
      <g className="m-lash-crack">
        <Lash d="M112 95 C126 86 140 102 154 94 C165 88 174 98 184 93" />
      </g>
      <g className="m-lash-follow">
        <Lash d="M100.3 121.9 C110 132 126 124 139 134 C150 142 162 140 175 146" />
      </g>
      <Burst x={tip.x} y={tip.y} className="m-spark" />
    </>
  )
}

// Impacto do tapa, do soco e do chute, onde a mão (ou o pé) encosta na pasta.
function Impact({ strike }: { strike: MeleeStrike }) {
  const tip = STRIKES[strike].tip
  return <Burst x={tip.x} y={tip.y} className="m-impact" />
}

// Hadouken: a bola de energia, desenhada onde bate (a pasta); a animação (.m-fireball) a traz das
// mãos até ali, com o rastro atrás. No fim, a explosão azul (.m-blast).
function Fireball() {
  const { url } = useFigure()
  const { x, y } = STRIKES.hadouken.tip
  return (
    <>
      <Pivot x={x} y={y} move="m-fireball">
        <path
          d={`M${x - 4} ${y - 9} C${x - 16} ${y - 8} ${x - 28} ${y - 3} ${x - 36} ${y} C${x - 28} ${y + 3} ${x - 16} ${y + 8} ${x - 4} ${y + 9} Z`}
          fill={url('energy-trail')}
        />
        <circle cx={x} cy={y} r={11} fill={url('energy')} />
        <circle cx={x + 1} cy={y} r={4.6} fill="#f4fdff" />
        <g fill="none" stroke="#9fe6ff" strokeWidth={1.2} strokeLinecap="round">
          <path d={`M${x - 6} ${y - 3} C${x - 2} ${y - 8} ${x + 6} ${y - 7} ${x + 7} ${y - 1}`} />
          <path d={`M${x + 6} ${y + 3} C${x + 2} ${y + 8} ${x - 6} ${y + 7} ${x - 7} ${y + 1}`} />
        </g>
      </Pivot>
      <Burst x={x} y={y} className="m-blast" color="blue" />
    </>
  )
}

// Rastro do movimento, só no instante do golpe: o arco da mão no tapa, as linhas atrás da luva no
// soco e o arco do pé no chute.
const SWOOSH: Record<MeleeStrike, string[]> = {
  slap: ['M90 60 C102 66 108 78 107 90', 'M86 66 C96 72 101 82 100 92'],
  punch: ['M82 89 L94 89', 'M80 103 L93 103', 'M86 85 L95 85'],
  kick: ['M68 146 C82 146 90 138 92 127', 'M66 140 C76 140 83 134 85 127']
}

function Swoosh({ strike }: { strike: MeleeStrike }) {
  return (
    <g className="m-swoosh" fill="none" stroke="#9ad0ff" strokeWidth={1.4} strokeLinecap="round">
      {SWOOSH[strike].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  )
}

// Os avisos ficam no mesmo lugar, acima do ombro direito: erro (triângulo vermelho), pergunta
// (bolinha azul com interrogação) e pronto (bolinha verde com check).
const BADGE = { x: 106, y: 24 }

function WarningBadge() {
  const { x, y } = BADGE
  return (
    <Pivot x={x} y={y} move="m-alarm">
      <path
        d={`M${x} ${y - 8.4} L${x + 8.4} ${y + 6.4} L${x - 8.4} ${y + 6.4} Z`}
        fill="#ff453a"
        stroke="#fff"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <rect x={x - 1} y={y - 3.6} width={2} height={5.6} rx={1} fill="#fff" />
      <circle cx={x} cy={y + 3.8} r={1.1} fill="#fff" />
    </Pivot>
  )
}

// Interrogação na bolinha e outras menores subindo do lado.
const QUESTIONS = [
  { x: 95, y: 12, size: 8 },
  { x: 117, y: 14, size: 6.5 }
]

function QuestionBadge() {
  const { x, y } = BADGE
  return (
    <>
      {QUESTIONS.map((q, i) => (
        <Pivot key={i} x={q.x} y={q.y} move={`m-float m-float-${i}`}>
          <text x={q.x} y={q.y} textAnchor="middle" fontSize={q.size} fontWeight={800} fontFamily="system-ui, sans-serif" fill="#0a84ff">
            ?
          </text>
        </Pivot>
      ))}
      <Pivot x={x} y={y} move="m-wobble">
        <circle cx={x} cy={y} r={7} fill="#0a84ff" stroke="#fff" strokeWidth={1.4} />
        <text x={x} y={y + 3.4} textAnchor="middle" fontSize={10} fontWeight={800} fontFamily="system-ui, sans-serif" fill="#fff">
          ?
        </text>
      </Pivot>
    </>
  )
}

function CheckBadge() {
  const { x, y } = BADGE
  return (
    <Pivot x={x} y={y} move="m-pop">
      <circle cx={x} cy={y} r={7} fill="#30d158" stroke="#fff" strokeWidth={1.4} />
      <path d={`M${x - 3.2} ${y + 0.2} L${x - 0.8} ${y + 2.6} L${x + 3.4} ${y - 2.4}`} fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Pivot>
  )
}

// Pensando: bolinhas subindo da cabeça até a nuvem, com três pontinhos que acendem em sequência.
const THOUGHT = { x: 114, y: 0 }

function ThoughtBubble() {
  const { x, y } = THOUGHT
  return (
    <g className="m-thought">
      <circle cx={97} cy={22} r={1.6} fill="#fff" />
      <circle cx={102.5} cy={13.5} r={2.6} fill="#fff" />
      <path
        d={`M${x - 10} ${y + 4} C${x - 14} ${y + 4} ${x - 14} ${y - 3} ${x - 9} ${y - 3} C${x - 8} ${y - 8} ${x - 1} ${y - 9} ${x + 1} ${y - 5} C${x + 5} ${y - 9} ${x + 12} ${y - 6} ${x + 10} ${y - 1} C${x + 15} ${y} ${x + 14} ${y + 7} ${x + 9} ${y + 6} C${x + 6} ${y + 10} ${x - 6} ${y + 10} ${x - 10} ${y + 4} Z`}
        fill="#fff"
        stroke="#d6dbe3"
        strokeWidth={0.8}
      />
      {[-5, 0, 5].map((dx, i) => (
        <Pivot key={dx} x={x + dx} y={y + 1} move={`m-dot m-dot-${i}`}>
          <circle cx={x + dx} cy={y + 1} r={1.5} fill="#5b6270" />
        </Pivot>
      ))}
    </g>
  )
}

// Digitando: pedacinhos de código subindo do notebook.
const CODE_BITS = [
  { x: 80, y: 100, text: '</>' },
  { x: 86, y: 108, text: '{ }' },
  { x: 78, y: 112, text: '01' }
]

function CodeBits() {
  return CODE_BITS.map((b, i) => (
    <Pivot key={i} x={b.x} y={b.y} move={`m-code m-code-${i}`}>
      <text x={b.x} y={b.y} fontSize={6} fontWeight={700} fontFamily="ui-monospace, Menlo, monospace" fill="#7cc4ff">
        {b.text}
      </text>
    </Pivot>
  ))
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
const EAR = onHead(101, 66)

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
