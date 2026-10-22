import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  Check,
  Dices,
  CircleCheck,
  CircleQuestionMark,
  Ear,
  Eye,
  Footprints,
  Laptop,
  Lightbulb,
  Link,
  Laugh,
  Music,
  PersonStanding,
  Pipette,
  RotateCcw,
  ScanFace,
  Scissors,
  Search,
  TriangleAlert,
  WandSparkles,
  Zap
} from 'lucide-react'
import {
  BEARD_STYLES,
  beardPalette,
  BUILDS,
  DEFAULT_LOOK,
  EYE_COLORS,
  EYE_SHAPES,
  eyePalette,
  FACE_SHAPES,
  HAIR_COLORS,
  HAIR_STYLES,
  hairPalette,
  isCustomColor,
  MOUTH_STYLES,
  randomLook,
  SEXES,
  SKIN_TONES,
  skinPalette,
  STRIKES,
  type CustomColor,
  type EyeColor,
  type HairColor,
  type MascotLook,
  type SkinTone,
  type Strike
} from '../../canvas/mascot/look'
import { MascotFigure, MascotHead, type Pose, type View } from '../../canvas/mascot/MascotFigure'
import { tr } from '../../i18n'
import { Button } from '../../ui/Button'
import { ExperimentTag } from '../../ui/ExperimentTag'
import { Modal } from '../../ui/Modal'
import { useModalClose } from '../../ui/modalContext'
import { getPreferences, setPreferences, usePreference } from '../preferences'

// Editor do mascote em tela cheia (aberto pelo botão da aba Mascote): o boneco grande à esquerda,
// mudando na hora e com botões para ver cada animação, e as escolhas à direita, em abas com ícone.
// Cada opção é uma miniatura já desenhada com ela; as cores, bolinhas (a última abre o seletor de
// cor do sistema). Tudo salva no clique.

// Pedaços do desenho (unidades do viewBox do mascote). Palco: centrado no corpo, com espaço dos
// dois lados para o chicote caber.
export const STAGE_VIEW: View = { x: -80, y: -14, w: 280, h: 168 }
const BODY_VIEW: View = { x: 12, y: -12, w: 96, h: 166 }
const HEAD_VIEW: View = { x: 12, y: -13, w: 96, h: 110 }
const EYES_VIEW: View = { x: 32, y: 34, w: 56, h: 26 }
const BEARD_VIEW: View = { x: 28, y: 42, w: 64, h: 54 }
const MOUTH_VIEW: View = { x: 40, y: 60, w: 40, h: 28 }
const STRIKE_VIEW: View = { x: 10, y: -14, w: 192, h: 166 }

const setLook = (patch: Partial<MascotLook>) => setPreferences({ mascotLook: { ...getPreferences().mascotLook, ...patch } })

type Tab = 'body' | 'face' | 'eyes' | 'mouth' | 'hair' | 'beard' | 'strike'
type IconType = ComponentType<{ size?: number; className?: string }>

// Bigode, no traço dos ícones do lucide (lá não tem um).
function MustacheIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 11c-1.5-2-4.5-2.5-6.5-.5C4 12 3 13 2 13c1 2.5 4 3.5 6.5 2.5 1.6-.6 2.8-1.6 3.5-2.5.7.9 1.9 1.9 3.5 2.5 2.5 1 5.5 0 6.5-2.5-1 0-2-1-3.5-2.5-2-2-5-1.5-6.5.5z" />
    </svg>
  )
}

const TABS: { id: Tab; label: string; icon: IconType }[] = [
  { id: 'body', label: tr('Corpo', 'Body'), icon: PersonStanding },
  { id: 'face', label: tr('Rosto', 'Face'), icon: ScanFace },
  { id: 'eyes', label: tr('Olhos', 'Eyes'), icon: Eye },
  { id: 'mouth', label: tr('Boca', 'Mouth'), icon: Laugh },
  { id: 'hair', label: tr('Cabelo', 'Hair'), icon: Scissors },
  { id: 'beard', label: tr('Barba', 'Beard'), icon: MustacheIcon },
  { id: 'strike', label: tr('Golpe', 'Strike'), icon: Zap }
]

// Animações para ver no palco. O golpe toca uma vez e volta para a que estava.
const LOOPS: { pose: Pose; label: string; icon: IconType }[] = [
  { pose: 'idle', label: tr('Parado', 'Idle'), icon: PersonStanding },
  { pose: 'walk', label: tr('Andando', 'Walking'), icon: Footprints },
  { pose: 'listen', label: tr('Escutando', 'Listening'), icon: Ear },
  { pose: 'think', label: tr('Pensando', 'Thinking'), icon: Lightbulb },
  { pose: 'type', label: tr('Digitando', 'Typing'), icon: Laptop },
  { pose: 'search', label: tr('Procurando', 'Searching'), icon: Search },
  { pose: 'dance', label: tr('Dançando', 'Dancing'), icon: Music },
  { pose: 'ask', label: tr('Pergunta', 'Question'), icon: CircleQuestionMark },
  { pose: 'thumbs', label: tr('Pronto', 'Done'), icon: CircleCheck },
  { pose: 'wave', label: tr('Erro', 'Error'), icon: TriangleAlert }
]

export function MascotEditor({ onClose }: { onClose: () => void }) {
  return (
    <Modal label={tr('Personalizar mascote', 'Customize mascot')} onClose={onClose} variant="blocking" size="auto" className="flex h-full w-full flex-col">
      <EditorBody />
    </Modal>
  )
}

function EditorBody() {
  const look = usePreference('mascotLook')
  const close = useModalClose()
  const [tab, setTab] = useState<Tab>('body')
  const [loop, setLoop] = useState<Pose>('idle')
  const [striking, setStriking] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Sai do golpe antes, para a animação recomeçar mesmo repetindo o mesmo.
  const playStrike = () => {
    clearTimeout(timer.current)
    setStriking(false)
    requestAnimationFrame(() => {
      setStriking(true)
      timer.current = window.setTimeout(() => setStriking(false), STRIKES[getPreferences().mascotLook.strike].ms)
    })
  }
  const pose: Pose = striking ? look.strike : loop

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3">
        <WandSparkles size={20} className="text-muted" />
        <h1 className="flex items-center gap-2 text-lg font-bold">
          {tr('Personalizar mascote', 'Customize mascot')}
          <ExperimentTag />
        </h1>
        <span className="text-[15px] text-muted">{tr('Cada escolha já vale no canvas.', 'Every choice applies to the canvas right away.')}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="xl" onClick={() => setPreferences({ mascotLook: randomLook() })}>
            <Dices size={15} />
            {tr('Sortear', 'Randomize')}
          </Button>
          <Button size="xl" onClick={() => setPreferences({ mascotLook: DEFAULT_LOOK })}>
            <RotateCcw size={15} />
            {tr('Restaurar padrão', 'Reset')}
          </Button>
          <Button size="xl" variant="primary" onClick={() => close('button')}>
            {tr('Pronto', 'Done')}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Palco: o boneco grande, com uma luz atrás. */}
        <section className="flex w-[42%] min-w-[340px] shrink-0 flex-col gap-4 border-r border-line p-6">
          <button
            type="button"
            onClick={playStrike}
            title={tr('Clique para ver o golpe', 'Click to see the strike')}
            className="min-h-0 w-full flex-1 cursor-pointer rounded-2xl"
            style={{
              background: 'radial-gradient(ellipse 60% 55% at 50% 58%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 70%)'
            }}
          >
            <MascotFigure pose={pose} look={look} view={STAGE_VIEW} />
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {LOOPS.map((l) => (
              <Chip key={l.pose} icon={l.icon} label={l.label} selected={!striking && loop === l.pose} onClick={() => setLoop(l.pose)} />
            ))}
            <Chip icon={Zap} label={STRIKES[look.strike].label} selected={striking} onClick={playStrike} />
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-4">
            {TABS.map((t) => {
              const Icon = t.icon
              const selected = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-w-20 shrink-0 flex-col items-center gap-1 border-b-2 px-3 pb-2 pt-3 text-[15px] ${
                    selected ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  <Icon size={22} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {tab === 'body' && <BodyTab look={look} />}
            {tab === 'face' && <FaceTab look={look} />}
            {tab === 'eyes' && <EyesTab look={look} />}
            {tab === 'mouth' && <MouthTab look={look} />}
            {tab === 'hair' && <HairTab look={look} />}
            {tab === 'beard' && <BeardTab look={look} />}
            {tab === 'strike' && (
              <StrikeTab
                look={look}
                onPick={(strike) => {
                  setLook({ strike })
                  playStrike()
                }}
              />
            )}
          </div>
        </section>
      </div>
    </>
  )
}

// ---------- abas ----------
// Em cada aba, as cores vêm primeiro e as formas depois.

function BodyTab({ look }: { look: MascotLook }) {
  const skin = skinPalette(look.skin)
  return (
    <>
      <Block title={tr('Tom de pele', 'Skin tone')} value={skin.label}>
        <Swatches
          value={look.skin}
          options={(Object.keys(SKIN_TONES) as SkinTone[]).map((k) => ({ value: k, label: SKIN_TONES[k].label, color: SKIN_TONES[k].skin[1] }))}
          pickerBase={skin.skin[1]}
          onChange={(value) => setLook({ skin: value })}
        />
      </Block>
      <Block title={tr('Sexo', 'Sex')} value={SEXES.find((s) => s.value === look.sex)?.label}>
        <Grid min={96}>
          {SEXES.map((s) => {
            // Como fica de fato ao trocar: o feminino vem sem barba.
            const next: Partial<MascotLook> = s.value === 'female' ? { sex: s.value, beard: 'none' } : { sex: s.value }
            return (
              <Tile key={s.value} label={s.label} view={BODY_VIEW} selected={look.sex === s.value} onClick={() => setLook(next)}>
                <MascotFigure pose="idle" look={{ ...look, ...next }} view={BODY_VIEW} still />
              </Tile>
            )
          })}
        </Grid>
      </Block>
      <Block title={tr('Tipo de corpo', 'Build')} value={BUILDS[look.build].label}>
        <Grid min={96}>
          {(Object.keys(BUILDS) as MascotLook['build'][]).map((b) => (
            <Tile key={b} label={BUILDS[b].label} view={BODY_VIEW} selected={look.build === b} onClick={() => setLook({ build: b })}>
              <MascotFigure pose="idle" look={{ ...look, build: b }} view={BODY_VIEW} still />
            </Tile>
          ))}
        </Grid>
      </Block>
    </>
  )
}

function FaceTab({ look }: { look: MascotLook }) {
  return (
    <Block title={tr('Formato do rosto', 'Face shape')} value={FACE_SHAPES.find((f) => f.value === look.face)?.label}>
      <Grid min={112}>
        {FACE_SHAPES.map((f) => (
          <Tile key={f.value} label={f.label} view={HEAD_VIEW} selected={look.face === f.value} onClick={() => setLook({ face: f.value })}>
            <MascotHead look={{ ...look, face: f.value }} view={HEAD_VIEW} />
          </Tile>
        ))}
      </Grid>
    </Block>
  )
}

function EyesTab({ look }: { look: MascotLook }) {
  const eye = eyePalette(look.eyeColor)
  return (
    <>
      <Block title={tr('Cor dos olhos', 'Eye color')} value={eye.label}>
        <Swatches
          value={look.eyeColor}
          options={(Object.keys(EYE_COLORS) as EyeColor[]).map((k) => ({ value: k, label: EYE_COLORS[k].label, color: EYE_COLORS[k].fill }))}
          pickerBase={eye.fill}
          onChange={(value) => setLook({ eyeColor: value })}
        />
      </Block>
      <Block title={tr('Formato dos olhos', 'Eye shape')} value={EYE_SHAPES.find((e) => e.value === look.eyes)?.label}>
        <Grid min={150}>
          {EYE_SHAPES.map((e) => (
            <Tile key={e.value} label={e.label} view={EYES_VIEW} selected={look.eyes === e.value} onClick={() => setLook({ eyes: e.value })}>
              <MascotHead look={{ ...look, eyes: e.value }} view={EYES_VIEW} />
            </Tile>
          ))}
        </Grid>
      </Block>
    </>
  )
}

// As miniaturas mostram a boca em repouso, que é o estilo em si.
function MouthTab({ look }: { look: MascotLook }) {
  return (
    <Block
      title={tr('Boca', 'Mouth')}
      value={MOUTH_STYLES.find((m) => m.value === look.mouth)?.label}
      description={tr(
        'Dando o golpe, dançando ou fazendo joia, ele abre o sorrisão; a língua e os dentões continuam aparecendo.',
        'While striking, dancing or giving a thumbs up it grins wide; the tongue and buck teeth still show.'
      )}
    >
      <Grid min={120}>
        {MOUTH_STYLES.map((m) => (
          <Tile key={m.value} label={m.label} view={MOUTH_VIEW} selected={look.mouth === m.value} onClick={() => setLook({ mouth: m.value })}>
            <MascotHead look={{ ...look, mouth: m.value }} view={MOUTH_VIEW} mouth="calm" />
          </Tile>
        ))}
      </Grid>
    </Block>
  )
}

function HairTab({ look }: { look: MascotLook }) {
  const hair = hairPalette(look.hairColor)
  return (
    <>
      <Block title={tr('Cor do cabelo', 'Hair color')} value={hair.label}>
        <Swatches
          value={look.hairColor}
          options={(Object.keys(HAIR_COLORS) as HairColor[]).map((k) => ({ value: k, label: HAIR_COLORS[k].label, color: HAIR_COLORS[k].top }))}
          pickerBase={hair.top}
          onChange={(value) => setLook({ hairColor: value })}
        />
      </Block>
      <Block title={tr('Corte', 'Style')} value={HAIR_STYLES.find((h) => h.value === look.hair)?.label}>
        <Grid min={112}>
          {HAIR_STYLES.map((h) => (
            <Tile key={h.value} label={h.label} view={HEAD_VIEW} selected={look.hair === h.value} onClick={() => setLook({ hair: h.value })}>
              <MascotHead look={{ ...look, hair: h.value }} view={HEAD_VIEW} />
            </Tile>
          ))}
        </Grid>
      </Block>
    </>
  )
}

function BeardTab({ look }: { look: MascotLook }) {
  const beard = beardPalette(look)
  const sameAsHair = tr('Igual ao cabelo', 'Same as hair')
  const none = look.beard === 'none'
  return (
    <>
      {/* Sem barba, a cor fica apagada (mas dá para deixar escolhida) e o lugar não muda ao escolher
          um estilo: as miniaturas não pulam para baixo. */}
      <Block
        title={tr('Cor da barba', 'Beard color')}
        value={look.beardColor === 'hair' ? sameAsHair : beard.label}
        description={none ? tr('Escolha um estilo abaixo para ver a cor.', 'Pick a style below to see the color.') : undefined}
        muted={none}
      >
        <Swatches
          value={look.beardColor}
          options={[
            { value: 'hair', label: sameAsHair, color: hairPalette(look.hairColor).beard, icon: true },
            ...(Object.keys(HAIR_COLORS) as HairColor[]).map((k) => ({ value: k, label: HAIR_COLORS[k].label, color: HAIR_COLORS[k].beard }))
          ]}
          pickerBase={beard.beard}
          onChange={(value) => setLook({ beardColor: value })}
        />
      </Block>
      <Block title={tr('Estilo', 'Style')} value={BEARD_STYLES.find((b) => b.value === look.beard)?.label}>
        <Grid min={120}>
          {BEARD_STYLES.map((b) => (
            <Tile key={b.value} label={b.label} view={BEARD_VIEW} selected={look.beard === b.value} onClick={() => setLook({ beard: b.value })}>
              <MascotHead look={{ ...look, beard: b.value }} view={BEARD_VIEW} />
            </Tile>
          ))}
        </Grid>
      </Block>
    </>
  )
}

function StrikeTab({ look, onPick }: { look: MascotLook; onPick: (strike: Strike) => void }) {
  return (
    <Block
      title={tr('Golpe no envio', 'Strike on send')}
      value={STRIKES[look.strike].label}
      description={tr(
        'O que ele faz na pasta da conversa quando você manda um pedido. Escolher já mostra no palco.',
        'What it does to the chat’s folder when you send a request. Picking one plays it on the stage.'
      )}
    >
      <Grid min={170}>
        {(Object.keys(STRIKES) as Strike[]).map((s) => (
          <Tile key={s} label={STRIKES[s].label} view={STRIKE_VIEW} selected={look.strike === s} onClick={() => onPick(s)}>
            <MascotFigure pose={s} look={{ ...look, strike: s }} view={STRIKE_VIEW} still />
          </Tile>
        ))}
      </Grid>
    </Block>
  )
}

// ---------- peças ----------

// Grupo de uma aba: título com a escolha atual ao lado, explicação opcional e as opções. muted:
// apagado (a escolha não aparece no boneco agora).
function Block({
  title,
  value,
  description,
  muted,
  children
}: {
  title: string
  value?: string
  description?: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <section className="mb-7 last:mb-0">
      <h2 className="flex items-baseline gap-2 text-[16px] font-semibold text-text">
        {title}
        {value && <span className="text-[15px] font-normal text-muted">{value}</span>}
      </h2>
      {description && <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{description}</p>}
      <div className={`mt-3 ${muted ? 'opacity-45' : ''}`}>{children}</div>
    </section>
  )
}

function Grid({ min, children }: { min: number; children: ReactNode }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {children}
    </div>
  )
}

// Opção com desenho: a miniatura em cima (na proporção do pedaço `view`), o nome embaixo e o
// visto no canto quando escolhida.
function Tile({ label, view, selected, onClick, children }: { label: string; view: View; selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-stretch gap-1.5 rounded-xl p-2 text-[15px] ${
        selected ? 'bg-accent/10 text-text ring-2 ring-accent' : 'text-muted ring-1 ring-line hover:bg-fill hover:text-text'
      }`}
    >
      <span className="relative block w-full overflow-hidden rounded-lg bg-fill" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
        <span className="absolute inset-1.5 block">{children}</span>
        {selected && (
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-md bg-accent text-white shadow-sm shadow-black/30">
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="truncate text-center">{label}</span>
    </button>
  )
}

const SWATCH = 'relative flex size-10 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface'
const swatchRing = (selected: boolean) => (selected ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-line-strong')
const ICON_SHADOW = 'drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.6)]'
// Bolinha do seletor, sem cor escolhida: o arco-íris diz "qualquer cor".
const RAINBOW = 'conic-gradient(from 90deg, #ff5f5f, #ffd84a, #6ad66a, #4ac8ff, #7a6cff, #ff6fd2, #ff5f5f)'

// Bolinhas de cor; o nome da escolhida vai no título do grupo. icon: a bolinha leva o elo ("igual
// ao cabelo"). A última abre o seletor de cor do sistema, começando na cor atual (pickerBase).
function Swatches<T extends string>({
  value,
  options,
  pickerBase,
  onChange
}: {
  value: T | CustomColor
  options: { value: T; label: string; color: string; icon?: boolean }[]
  pickerBase: string
  onChange: (value: T | CustomColor) => void
}) {
  const custom = isCustomColor(value)
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          title={o.label}
          aria-label={o.label}
          aria-pressed={value === o.value}
          className={`${SWATCH} ${swatchRing(value === o.value)}`}
          style={{ background: o.color }}
        >
          {o.icon && <Link size={16} strokeWidth={2.5} className={ICON_SHADOW} />}
        </button>
      ))}
      <ColorPicker color={custom ? value : pickerBase} selected={custom} onPick={onChange} />
    </div>
  )
}

// Abre o seletor de cor do sistema (o input de cor do navegador, transparente por cima da bolinha).
// Enquanto se arrasta nele, o boneco já muda. Com uma cor escolhida, a bolinha fica nela.
function ColorPicker({ color, selected, onPick }: { color: string; selected: boolean; onPick: (color: CustomColor) => void }) {
  const label = tr('Escolher outra cor', 'Pick another color')
  return (
    <label
      title={label}
      className={`${SWATCH} ${swatchRing(selected)} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent`}
      style={{ background: selected ? color : RAINBOW }}
    >
      <Pipette size={16} strokeWidth={2.5} className={`pointer-events-none ${ICON_SHADOW}`} />
      <input
        type="color"
        aria-label={label}
        value={color}
        onChange={(e) => onPick(e.target.value.toLowerCase() as CustomColor)}
        className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
      />
    </label>
  )
}

// Botão das animações do palco: ícone e nome, aceso quando é a que está tocando.
function Chip({ icon: Icon, label, selected, onClick }: { icon: IconType; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[15px] ${
        selected ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'text-muted ring-1 ring-line hover:bg-fill hover:text-text'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}
