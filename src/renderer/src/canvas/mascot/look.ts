import { tr } from '../../i18n'

// Como o mascote é: corpo, cabelo, rosto, olhos, boca, pele, barba, roupa e o golpe que ele dá no
// envio do pedido. Escolhido em Configurações > Mascote. A roupa padrão é a original, camiseta
// amarela e calça preta; o corte de cada peça acompanha o sexo. As cores (pele, olhos, cabelo,
// barba, roupa) são uma das prontas ou uma escolhida no seletor.

export type MascotSex = 'male' | 'female'
export type BodyBuild = 'skinny' | 'slim' | 'average' | 'strong' | 'chubby'
export type HairStyle =
  | 'quiff'
  | 'buzz'
  | 'bald'
  | 'balding'
  | 'undercut'
  | 'mohawk'
  | 'spiky'
  | 'sidePart'
  | 'slickBack'
  | 'pixie'
  | 'bowl'
  | 'curly'
  | 'afro'
  | 'mullet'
  | 'dreads'
  | 'bob'
  | 'wavy'
  | 'wavyBob'
  | 'curtainWaves'
  | 'beachWaves'
  | 'longCurly'
  | 'long'
  | 'ponytail'
  | 'pigtails'
  | 'braids'
  | 'bun'
export type HairColor = 'lightBrown' | 'darkBrown' | 'black' | 'blonde' | 'platinum' | 'red' | 'gray' | 'pink' | 'blue'
export type FaceShape =
  | 'oval'
  | 'round'
  | 'square'
  | 'long'
  | 'heart'
  | 'diamond'
  | 'triangle'
  | 'chubby'
  | 'chin'
  | 'wide'
  | 'vshape'
  | 'pear'
  | 'rectangle'
  | 'baby'
  | 'angular'
export type EyeShape =
  | 'almond'
  | 'round'
  | 'narrow'
  | 'sleepy'
  | 'upturned'
  | 'downturned'
  | 'big'
  | 'wide'
  | 'monolid'
  | 'determined'
  | 'starry'
  | 'dot'
  | 'happy'
  | 'wink'
  | 'hearts'
export type EyeColor = 'grayGreen' | 'brown' | 'darkBrown' | 'hazel' | 'green' | 'blue' | 'gray'
export type SkinTone = 'fair' | 'light' | 'tan' | 'brown' | 'dark'
export type BeardStyle =
  | 'none'
  | 'stubble'
  | 'pencil'
  | 'mustache'
  | 'handlebar'
  | 'soulPatch'
  | 'goatee'
  | 'chinstrap'
  | 'muttonChops'
  | 'full'
  | 'long'
// 'hair': a mesma cor do cabelo.
export type BeardColor = 'hair' | HairColor
export type MouthStyle =
  | 'classic'
  | 'smile'
  | 'smallSmile'
  | 'smirk'
  | 'full'
  | 'pout'
  | 'thin'
  | 'teeth'
  | 'laugh'
  | 'open'
  | 'tongue'
  | 'buck'
  | 'fangs'
  | 'serious'
  | 'frown'
export type Strike = 'whip' | 'slap' | 'punch' | 'kick' | 'hadouken'
// Parte de cima: camiseta, regata, blusinha, camisa (de botão) e jaqueta (aberta, por cima de uma
// camiseta branca). Parte de baixo: calça, bermuda, shorts e saia.
export type TopStyle = 'tee' | 'tank' | 'blouse' | 'shirt' | 'jacket'
export type BottomStyle = 'pants' | 'bermuda' | 'shorts' | 'skirt'
// Acessórios: dá para usar vários juntos, menos dois no mesmo lugar (um óculos e um chapéu por vez,
// ver ACCESSORY_SLOT).
export type Accessory = 'glasses' | 'aviators' | 'sunglasses' | 'cap' | 'beanie' | 'bow' | 'earrings' | 'necklace' | 'bracelet' | 'watch'
export type ClothColor = 'yellow' | 'black' | 'white' | 'gray' | 'navy' | 'denim' | 'red' | 'green' | 'pink' | 'purple' | 'beige'
// Golpes de perto, de frente, em que a mão ou o pé encosta na pasta.
export type MeleeStrike = 'slap' | 'punch' | 'kick'
// Cor escolhida no seletor (#rrggbb), no lugar de uma das prontas.
export type CustomColor = `#${string}`

export const isCustomColor = (value: unknown): value is CustomColor => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export type MascotLook = {
  sex: MascotSex
  build: BodyBuild
  hair: HairStyle
  hairColor: HairColor | CustomColor
  face: FaceShape
  eyes: EyeShape
  eyeColor: EyeColor | CustomColor
  mouth: MouthStyle
  skin: SkinTone | CustomColor
  beard: BeardStyle
  beardColor: BeardColor | CustomColor
  top: TopStyle
  topColor: ClothColor | CustomColor
  bottom: BottomStyle
  bottomColor: ClothColor | CustomColor
  accessories: Accessory[]
  strike: Strike
}

// O mascote de antes da personalização.
export const DEFAULT_LOOK: MascotLook = {
  sex: 'male',
  build: 'slim',
  hair: 'quiff',
  hairColor: 'lightBrown',
  face: 'oval',
  eyes: 'almond',
  eyeColor: 'grayGreen',
  mouth: 'classic',
  skin: 'light',
  beard: 'stubble',
  beardColor: 'hair',
  top: 'tee',
  topColor: 'yellow',
  bottom: 'pants',
  bottomColor: 'black',
  accessories: [],
  strike: 'whip'
}

export const SEXES: { value: MascotSex; label: string }[] = [
  { value: 'male', label: tr('Masculino', 'Male') },
  { value: 'female', label: tr('Feminino', 'Female') }
]

// torso: largura da camiseta (e da calça em cima); shoulder: quanto cada ombro sai para fora (negativo
// entra); arm: grossura do braço; hip: quanto cada perna sai para fora; leg: grossura da perna;
// belly: barriga.
export type BuildShape = { label: string; torso: number; shoulder: number; arm: number; hip: number; leg: number; belly?: boolean; chest?: boolean }

export const BUILDS: Record<BodyBuild, BuildShape> = {
  skinny: { label: tr('Muito magro', 'Skinny'), torso: 0.86, shoulder: -1.4, arm: 0.8, hip: -0.5, leg: 0.8 },
  slim: { label: tr('Magro', 'Slim'), torso: 1, shoulder: 0, arm: 1, hip: 0, leg: 1 },
  average: { label: tr('Médio', 'Average'), torso: 1.1, shoulder: 1.5, arm: 1.12, hip: 0.6, leg: 1.1 },
  strong: { label: tr('Forte', 'Strong'), torso: 1.22, shoulder: 3.4, arm: 1.38, hip: 1, leg: 1.22, chest: true },
  chubby: { label: tr('Gordinho', 'Chubby'), torso: 1.26, shoulder: 3.2, arm: 1.26, hip: 1.6, leg: 1.26, belly: true }
}

export const HAIR_STYLES: { value: HairStyle; label: string }[] = [
  { value: 'quiff', label: tr('Topete', 'Quiff') },
  { value: 'buzz', label: tr('Máquina baixa', 'Buzz cut') },
  { value: 'bald', label: tr('Careca', 'Shaved') },
  { value: 'balding', label: tr('Calvo', 'Balding') },
  { value: 'undercut', label: tr('Raspado dos lados', 'Undercut') },
  { value: 'mohawk', label: tr('Moicano', 'Mohawk') },
  { value: 'spiky', label: tr('Espetado', 'Spiky') },
  { value: 'sidePart', label: tr('Social', 'Side part') },
  { value: 'slickBack', label: tr('Para trás', 'Slicked back') },
  { value: 'pixie', label: tr('Joãozinho', 'Pixie') },
  { value: 'bowl', label: tr('Cuia', 'Bowl cut') },
  { value: 'curly', label: tr('Cacheado', 'Curly') },
  { value: 'afro', label: tr('Black power', 'Afro') },
  { value: 'mullet', label: tr('Mullet', 'Mullet') },
  { value: 'dreads', label: tr('Dreads', 'Dreadlocks') },
  { value: 'bob', label: tr('Chanel', 'Bob') },
  { value: 'wavy', label: tr('Ondulado', 'Wavy') },
  { value: 'wavyBob', label: tr('Chanel ondulado', 'Wavy bob') },
  { value: 'curtainWaves', label: tr('Ondulado com franja', 'Waves with curtain bangs') },
  { value: 'beachWaves', label: tr('Ondas longas', 'Long waves') },
  { value: 'longCurly', label: tr('Cacheado longo', 'Long curls') },
  { value: 'long', label: tr('Longo', 'Long') },
  { value: 'ponytail', label: tr('Rabo de cavalo', 'Ponytail') },
  { value: 'pigtails', label: tr('Maria-chiquinha', 'Pigtails') },
  { value: 'braids', label: tr('Tranças', 'Braids') },
  { value: 'bun', label: tr('Coque', 'Bun') }
]

// Cabelo que cobre as orelhas: elas não são desenhadas.
export const COVERS_EARS: Partial<Record<HairStyle, boolean>> = {
  bob: true,
  wavy: true,
  wavyBob: true,
  curtainWaves: true,
  beachWaves: true,
  longCurly: true,
  long: true,
  afro: true,
  dreads: true
}

export type HairPalette = { label: string; top: string; bottom: string; strand: string; brow: string; beard: string }

// top/bottom: degradê do cabelo; strand: as mechas; brow: sobrancelha; beard: barba e bigode.
export const HAIR_COLORS: Record<HairColor, HairPalette> = {
  lightBrown: { label: tr('Castanho-claro', 'Light brown'), top: '#8d6544', bottom: '#694630', strand: '#a98059', brow: '#4e3423', beard: '#7a4f33' },
  darkBrown: { label: tr('Castanho-escuro', 'Dark brown'), top: '#5a3c27', bottom: '#3d281a', strand: '#7a5a40', brow: '#2e1f15', beard: '#3d281a' },
  black: { label: tr('Preto', 'Black'), top: '#34302f', bottom: '#1b1919', strand: '#5a5452', brow: '#171414', beard: '#211d1c' },
  blonde: { label: tr('Loiro', 'Blonde'), top: '#dab56c', bottom: '#b98e48', strand: '#f0d597', brow: '#8f6a3a', beard: '#a37a45' },
  red: { label: tr('Ruivo', 'Red'), top: '#b65a2f', bottom: '#8c3f1f', strand: '#d68050', brow: '#6e3218', beard: '#94461f' },
  gray: { label: tr('Grisalho', 'Gray'), top: '#bab7b2', bottom: '#8f8c88', strand: '#dedbd6', brow: '#6f6b67', beard: '#85817c' },
  platinum: { label: tr('Platinado', 'Platinum'), top: '#ece6d6', bottom: '#cfc6b0', strand: '#fffaf0', brow: '#9a8f7a', beard: '#b5ab95' },
  pink: { label: tr('Rosa', 'Pink'), top: '#e58ab5', bottom: '#c46093', strand: '#f6b7d4', brow: '#7a3e5c', beard: '#b0507f' },
  blue: { label: tr('Azul', 'Blue'), top: '#5b8fd6', bottom: '#3c66aa', strand: '#9cc0f0', brow: '#2f4a78', beard: '#3c66aa' }
}

// ---------- roupa ----------

export const TOP_STYLES: { value: TopStyle; label: string }[] = [
  { value: 'tee', label: tr('Camiseta', 'T-shirt') },
  { value: 'tank', label: tr('Regata', 'Tank top') },
  { value: 'blouse', label: tr('Blusinha', 'Blouse') },
  { value: 'shirt', label: tr('Camisa', 'Button-up shirt') },
  { value: 'jacket', label: tr('Jaqueta', 'Jacket') }
]

export const BOTTOM_STYLES: { value: BottomStyle; label: string }[] = [
  { value: 'pants', label: tr('Calça', 'Pants') },
  { value: 'bermuda', label: tr('Bermuda', 'Bermuda shorts') },
  { value: 'shorts', label: tr('Shorts', 'Shorts') },
  { value: 'skirt', label: tr('Saia', 'Skirt') }
]

// Tons de uma peça. mid/edge: o degradê (meio claro, laterais mais escuras); collar: gola e barras;
// fold: dobras e costuras; hem: a linha da barra. Nas cores escuras, os detalhes clareiam.
export type ClothPalette = { label: string; mid: string; edge: string; collar: string; fold: string; hem: string }

export const CLOTH_COLORS: Record<ClothColor, { label: string; color: string }> = {
  yellow: { label: tr('Amarelo', 'Yellow'), color: '#fbd347' },
  black: { label: tr('Preto', 'Black'), color: '#2c2d33' },
  white: { label: tr('Branco', 'White'), color: '#f4f4f1' },
  gray: { label: tr('Cinza', 'Gray'), color: '#9a9ca3' },
  navy: { label: tr('Azul-marinho', 'Navy'), color: '#2f3d66' },
  denim: { label: tr('Jeans', 'Denim'), color: '#4f74a8' },
  red: { label: tr('Vermelho', 'Red'), color: '#e0483e' },
  green: { label: tr('Verde', 'Green'), color: '#4caf6e' },
  pink: { label: tr('Rosa', 'Pink'), color: '#f08cb4' },
  purple: { label: tr('Roxo', 'Purple'), color: '#8a63d2' },
  beige: { label: tr('Bege', 'Beige'), color: '#d9c4a0' }
}

// A camiseta amarela e a calça preta guardam os tons exatos do desenho original.
const ORIGINAL_CLOTH: Partial<Record<ClothColor, Omit<ClothPalette, 'label'>>> = {
  yellow: { mid: '#fbd347', edge: '#dca61c', collar: '#c9930f', fold: '#a87a0c', hem: '#b8860d' },
  black: { mid: '#2c2d33', edge: '#16161a', collar: '#3c3d44', fold: '#45464e', hem: '#45464e' }
}

const ORIGINAL_SLEEVE = { mid: '#f8cf42', edge: '#e0aa22', cuff: '#c08c10' }

export function clothPalette(color: MascotLook['topColor']): ClothPalette {
  const preset = isCustomColor(color) ? undefined : CLOTH_COLORS[color]
  const label = preset?.label ?? CUSTOM_LABEL
  const original = isCustomColor(color) ? undefined : ORIGINAL_CLOTH[color]
  if (original) return { label, ...original }
  const base = preset?.color ?? color
  const dark = luminance(base) < 0.3
  const detail = (t: number) => (dark ? lighten(base, t) : darken(base, t))
  return { label, mid: base, edge: darken(base, dark ? 0.35 : 0.13), collar: detail(0.2), fold: detail(0.32), hem: detail(0.26) }
}

// Manga: um tom acima da peça, com a barra. Na camiseta amarela, o original.
export function sleevePalette(color: MascotLook['topColor']): { mid: string; edge: string; cuff: string } {
  if (color === 'yellow') return ORIGINAL_SLEEVE
  const c = clothPalette(color)
  return { mid: c.mid, edge: mix(c.edge, c.mid, 0.2), cuff: c.collar }
}

// ---------- acessórios ----------

export const ACCESSORIES: { value: Accessory; label: string }[] = [
  { value: 'glasses', label: tr('Óculos de grau', 'Glasses') },
  { value: 'aviators', label: tr('Óculos aviador', 'Aviators') },
  { value: 'sunglasses', label: tr('Óculos escuros', 'Sunglasses') },
  { value: 'cap', label: tr('Boné', 'Cap') },
  { value: 'beanie', label: tr('Gorro', 'Beanie') },
  { value: 'bow', label: tr('Laço', 'Hair bow') },
  { value: 'earrings', label: tr('Brincos', 'Earrings') },
  { value: 'necklace', label: tr('Colar', 'Necklace') },
  { value: 'bracelet', label: tr('Pulseira', 'Bracelet') },
  { value: 'watch', label: tr('Relógio', 'Watch') }
]

// Acessórios que ocupam o mesmo lugar: escolher um tira o outro.
export const ACCESSORY_SLOT: Partial<Record<Accessory, 'eyes' | 'head'>> = {
  glasses: 'eyes',
  aviators: 'eyes',
  sunglasses: 'eyes',
  cap: 'head',
  beanie: 'head',
  bow: 'head'
}

// Liga ou desliga um acessório, tirando o que estiver no mesmo lugar.
export function toggleAccessory(list: Accessory[], item: Accessory): Accessory[] {
  if (list.includes(item)) return list.filter((a) => a !== item)
  const slot = ACCESSORY_SLOT[item]
  return [...list.filter((a) => !slot || ACCESSORY_SLOT[a] !== slot), item]
}

export const FACE_SHAPES: { value: FaceShape; label: string }[] = [
  { value: 'oval', label: tr('Oval', 'Oval') },
  { value: 'round', label: tr('Redondo', 'Round') },
  { value: 'square', label: tr('Quadrado', 'Square') },
  { value: 'long', label: tr('Fino', 'Slim') },
  { value: 'heart', label: tr('Coração', 'Heart') },
  { value: 'diamond', label: tr('Losango', 'Diamond') },
  { value: 'triangle', label: tr('Triangular', 'Triangle') },
  { value: 'chubby', label: tr('Bochechudo', 'Chubby cheeks') },
  { value: 'chin', label: tr('Queixo marcado', 'Strong chin') },
  { value: 'wide', label: tr('Largo', 'Wide') },
  { value: 'vshape', label: tr('Queixo fino', 'V-shape') },
  { value: 'pear', label: tr('Pera', 'Pear') },
  { value: 'rectangle', label: tr('Retangular', 'Rectangle') },
  { value: 'baby', label: tr('Rosto de bebê', 'Baby face') },
  { value: 'angular', label: tr('Anguloso', 'Angular') }
]

export const EYE_SHAPES: { value: EyeShape; label: string }[] = [
  { value: 'almond', label: tr('Amendoado', 'Almond') },
  { value: 'round', label: tr('Redondo', 'Round') },
  { value: 'narrow', label: tr('Estreito', 'Narrow') },
  { value: 'sleepy', label: tr('Sonolento', 'Sleepy') },
  { value: 'upturned', label: tr('Gatinho', 'Cat-eye') },
  { value: 'downturned', label: tr('Caídos', 'Droopy') },
  { value: 'big', label: tr('Grandes', 'Big') },
  { value: 'wide', label: tr('Arregalados', 'Wide open') },
  { value: 'monolid', label: tr('Sem dobra', 'Monolid') },
  { value: 'determined', label: tr('Determinados', 'Determined') },
  { value: 'starry', label: tr('Brilhantes', 'Sparkly') },
  { value: 'dot', label: tr('Bolinha', 'Dots') },
  { value: 'happy', label: tr('Sorrindo', 'Happy') },
  { value: 'wink', label: tr('Piscadinha', 'Wink') },
  { value: 'hearts', label: tr('Apaixonados', 'Heart eyes') }
]

// fill: íris; ring: contorno dela.
export const EYE_COLORS: Record<EyeColor, { label: string; fill: string; ring: string }> = {
  grayGreen: { label: tr('Verde-acinzentado', 'Gray-green'), fill: '#7c8975', ring: '#4b5546' },
  brown: { label: tr('Castanho', 'Brown'), fill: '#8a5a3a', ring: '#5a3620' },
  darkBrown: { label: tr('Castanho-escuro', 'Dark brown'), fill: '#4e3022', ring: '#2e1a10' },
  hazel: { label: tr('Mel', 'Hazel'), fill: '#a87f3e', ring: '#6a4f22' },
  green: { label: tr('Verde', 'Green'), fill: '#5f9a5a', ring: '#3a6236' },
  blue: { label: tr('Azul', 'Blue'), fill: '#5d8fc4', ring: '#345c88' },
  gray: { label: tr('Cinza', 'Gray'), fill: '#8e979e', ring: '#5a6268' }
}

export const MOUTH_STYLES: { value: MouthStyle; label: string }[] = [
  { value: 'classic', label: tr('Clássica', 'Classic') },
  { value: 'smile', label: tr('Sorridente', 'Smiling') },
  { value: 'smallSmile', label: tr('Sorrisinho', 'Little smile') },
  { value: 'smirk', label: tr('De lado', 'Smirk') },
  { value: 'full', label: tr('Carnuda', 'Full lips') },
  { value: 'pout', label: tr('Biquinho', 'Pout') },
  { value: 'thin', label: tr('Fina', 'Thin') },
  { value: 'teeth', label: tr('Dentes à mostra', 'Toothy') },
  { value: 'laugh', label: tr('Gargalhada', 'Laughing') },
  { value: 'open', label: tr('Surpresa', 'Surprised') },
  { value: 'tongue', label: tr('Língua de fora', 'Tongue out') },
  { value: 'buck', label: tr('Dentuça', 'Buck teeth') },
  { value: 'fangs', label: tr('Presinhas', 'Fangs') },
  { value: 'serious', label: tr('Séria', 'Serious') },
  { value: 'frown', label: tr('Emburrada', 'Frown') }
]

export const BEARD_STYLES: { value: BeardStyle; label: string }[] = [
  { value: 'none', label: tr('Sem barba', 'None') },
  { value: 'stubble', label: tr('Rala', 'Stubble') },
  { value: 'pencil', label: tr('Bigode fino', 'Pencil mustache') },
  { value: 'mustache', label: tr('Só bigode', 'Mustache') },
  { value: 'handlebar', label: tr('Bigode de guidão', 'Handlebar') },
  { value: 'soulPatch', label: tr('Mosca', 'Soul patch') },
  { value: 'goatee', label: tr('Cavanhaque', 'Goatee') },
  { value: 'chinstrap', label: tr('Contorno', 'Chinstrap') },
  { value: 'muttonChops', label: tr('Costeletas', 'Mutton chops') },
  { value: 'full', label: tr('Cheia', 'Full') },
  { value: 'long', label: tr('Longa', 'Long') }
]

// skin: degradê do rosto (claro, meio, sombra); limb: braços e mãos (borda, meio, borda);
// line: traços finos (orelha, pálpebra, nariz); soft: brilho da mão e da ponta do nariz;
// deep: contorno da narina; nostril: narina; lip: degradê da boca; lipTop: lábio de cima;
// lipLine: linha da boca; nail: unha.
export type SkinPalette = {
  label: string
  skin: [string, string, string]
  limb: [string, string, string]
  line: string
  soft: string
  deep: string
  nostril: string
  lip: [string, string]
  lipTop: string
  lipLine: string
  nail: string
}

export const SKIN_TONES: Record<SkinTone, SkinPalette> = {
  fair: {
    label: tr('Muito clara', 'Very light'),
    skin: ['#fbe6d6', '#f3cfb6', '#e0b093'],
    limb: ['#e6bba0', '#f6d8c2', '#e3b598'],
    line: '#d9a78a',
    soft: '#ecbfa5',
    deep: '#c08a6c',
    nostril: '#a0684d',
    lip: ['#d8949a', '#bb7378'],
    lipTop: '#c27f84',
    lipLine: '#844a4d',
    nail: '#fae2d6'
  },
  light: {
    label: tr('Clara', 'Light'),
    skin: ['#f5d4ba', '#eabb99', '#d49c7a'],
    limb: ['#dca584', '#f0c6a6', '#d9a07f'],
    line: '#cf9576',
    soft: '#e8b493',
    deep: '#b67858',
    nostril: '#93593f',
    lip: ['#cf8a7f', '#b26c63'],
    lipTop: '#b8746a',
    lipLine: '#7a433c',
    nail: '#f5d3c2'
  },
  tan: {
    label: tr('Média', 'Medium'),
    skin: ['#e5b48b', '#d39d71', '#b78058'],
    limb: ['#c78f65', '#dfac80', '#c38960'],
    line: '#b07c57',
    soft: '#d6a073',
    deep: '#9a6442',
    nostril: '#7a4a2f',
    lip: ['#bd7a6a', '#9e5f52'],
    lipTop: '#a8695b',
    lipLine: '#6a3a30',
    nail: '#efcaa8'
  },
  brown: {
    label: tr('Escura', 'Dark'),
    skin: ['#bd875f', '#a8714a', '#8b5735'],
    limb: ['#9a6440', '#b88259', '#965f3c'],
    line: '#8a5534',
    soft: '#b07a52',
    deep: '#6f4026',
    nostril: '#53301c',
    lip: ['#9a5c4c', '#7d4639'],
    lipTop: '#874e40',
    lipLine: '#4e2a20',
    nail: '#d9b08e'
  },
  dark: {
    label: tr('Muito escura', 'Very dark'),
    skin: ['#8f5f40', '#77492e', '#5e361f'],
    limb: ['#6a3f26', '#855536', '#673d24'],
    line: '#5c3620',
    soft: '#7e5034',
    deep: '#47271a',
    nostril: '#331b10',
    lip: ['#7a4638', '#5f3329'],
    lipTop: '#6a3b2f',
    lipLine: '#3a1d14',
    nail: '#b68a6c'
  }
}

// ---------- cores escolhidas no seletor ----------
// A partir da cor escolhida, os outros tons (sombra, mechas, sobrancelha, lábios) saem por conta,
// do mesmo jeito que nas cores prontas.

export const CUSTOM_LABEL = tr('Personalizada', 'Custom')

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (channels: number[]) =>
  `#${channels.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

// a + (b - a) * t, canal a canal.
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}
const lighten = (c: string, t: number) => mix(c, '#ffffff', t)
const darken = (c: string, t: number) => mix(c, '#000000', t)
// Claridade percebida, de 0 (preto) a 1 (branco).
function luminance(c: string): number {
  const [r, g, b] = rgb(c)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
// Sombra de pele: escurece mais o verde e o azul que o vermelho, como nos tons prontos (t 0.2 dá a
// linha fina da pele clara a partir do tom do meio).
function warmShade(c: string, t: number): string {
  const [r, g, b] = rgb(c)
  return toHex([r * (1 - 0.6 * t), g * (1 - t), b * (1 - 1.2 * t)])
}

export function hairPalette(color: MascotLook['hairColor']): HairPalette {
  if (!isCustomColor(color)) return HAIR_COLORS[color]
  return { label: CUSTOM_LABEL, top: color, bottom: darken(color, 0.25), strand: lighten(color, 0.22), brow: darken(color, 0.45), beard: darken(color, 0.13) }
}

// Barba: a do cabelo, uma das prontas ou a escolhida (essa, exatamente na cor escolhida).
export function beardPalette(look: MascotLook): HairPalette {
  const color = look.beardColor
  if (color === 'hair') return hairPalette(look.hairColor)
  if (!isCustomColor(color)) return HAIR_COLORS[color]
  return { ...hairPalette(color), beard: color }
}

// O tom escolhido vira o tom do meio do rosto.
export function skinPalette(tone: MascotLook['skin']): SkinPalette {
  if (!isCustomColor(tone)) return SKIN_TONES[tone]
  return {
    label: CUSTOM_LABEL,
    skin: [lighten(tone, 0.3), tone, warmShade(tone, 0.16)],
    limb: [warmShade(tone, 0.12), lighten(tone, 0.12), warmShade(tone, 0.13)],
    line: warmShade(tone, 0.2),
    soft: warmShade(tone, 0.04),
    deep: warmShade(tone, 0.36),
    nostril: warmShade(tone, 0.52),
    lip: [mix(warmShade(tone, 0.1), '#c0505a', 0.3), mix(warmShade(tone, 0.2), '#9a3a44', 0.35)],
    lipTop: mix(warmShade(tone, 0.15), '#a8424c', 0.32),
    lipLine: warmShade(mix(tone, '#7a2a22', 0.2), 0.55),
    nail: lighten(tone, 0.35)
  }
}

export function eyePalette(color: MascotLook['eyeColor']): { label: string; fill: string; ring: string } {
  if (!isCustomColor(color)) return EYE_COLORS[color]
  return { label: CUSTOM_LABEL, fill: color, ring: darken(color, 0.4) }
}

// ms: duração do golpe. tip: ponto do desenho que encosta na pasta no impacto (a ponta do chicote,
// a mão, a luva, o pé, a bola de energia do hadouken); a caminhada para com ele no cabeçalho da pasta.
export const STRIKES: Record<Strike, { label: string; ms: number; tip: { x: number; y: number } }> = {
  whip: { label: tr('Chicotada', 'Whip'), ms: 1000, tip: { x: 186.5, y: 93 } },
  slap: { label: tr('Tapa', 'Slap'), ms: 900, tip: { x: 107.5, y: 96 } },
  punch: { label: tr('Soco', 'Punch'), ms: 900, tip: { x: 109, y: 96.5 } },
  kick: { label: tr('Chute', 'Kick'), ms: 1000, tip: { x: 91, y: 121 } },
  hadouken: { label: 'Hadouken', ms: 1100, tip: { x: 188, y: 96 } }
}

// O corpo como é desenhado: o tipo escolhido e, no feminino, ombros mais para dentro, braços mais
// finos e o quadril mais para fora.
export function bodyShape(look: MascotLook): BuildShape {
  const build = BUILDS[look.build]
  if (look.sex !== 'female') return build
  return { ...build, shoulder: build.shoulder - 1.2, arm: build.arm * 0.88, hip: build.hip + 0.8 }
}

// Ponta do golpe com o corpo escolhido: o ombro (ou o quadril, no chute) mais largo leva a mão (ou
// o pé) junto. A bola do hadouken voa solta, não depende do corpo.
export function strikeTip(look: MascotLook): { x: number; y: number } {
  const { tip } = STRIKES[look.strike]
  const build = bodyShape(look)
  const shift = look.strike === 'hadouken' ? 0 : look.strike === 'kick' ? build.hip : build.shoulder
  return { x: tip.x + shift, y: tip.y }
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback
// Uma das cores prontas ou uma escolhida no seletor.
const pickColor = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | CustomColor =>
  isCustomColor(value) ? (value.toLowerCase() as CustomColor) : pick(value, allowed, fallback)

// Visual salvo, com o padrão no que faltar ou não existir mais.
export function normalizeLook(saved: unknown): MascotLook {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof MascotLook, unknown>>
  const hairColors = Object.keys(HAIR_COLORS) as HairColor[]
  const clothColors = Object.keys(CLOTH_COLORS) as ClothColor[]
  // A barba era ligada ou desligada até ganhar estilos.
  const beard = s.beard === true ? 'stubble' : s.beard === false ? 'none' : s.beard
  return {
    sex: pick(s.sex, ['male', 'female'], DEFAULT_LOOK.sex),
    build: pick(s.build, Object.keys(BUILDS) as BodyBuild[], DEFAULT_LOOK.build),
    hair: pick(s.hair, HAIR_STYLES.map((h) => h.value), DEFAULT_LOOK.hair),
    hairColor: pickColor(s.hairColor, hairColors, 'lightBrown'),
    face: pick(s.face, FACE_SHAPES.map((f) => f.value), DEFAULT_LOOK.face),
    eyes: pick(s.eyes, EYE_SHAPES.map((e) => e.value), DEFAULT_LOOK.eyes),
    eyeColor: pickColor(s.eyeColor, Object.keys(EYE_COLORS) as EyeColor[], 'grayGreen'),
    mouth: pick(s.mouth, MOUTH_STYLES.map((m) => m.value), DEFAULT_LOOK.mouth),
    skin: pickColor(s.skin, Object.keys(SKIN_TONES) as SkinTone[], 'light'),
    beard: pick(beard, BEARD_STYLES.map((b) => b.value), DEFAULT_LOOK.beard),
    beardColor: pickColor(s.beardColor, ['hair', ...hairColors], 'hair'),
    top: pick(s.top, TOP_STYLES.map((t) => t.value), DEFAULT_LOOK.top),
    topColor: pickColor(s.topColor, clothColors, DEFAULT_LOOK.topColor as ClothColor),
    bottom: pick(s.bottom, BOTTOM_STYLES.map((b) => b.value), DEFAULT_LOOK.bottom),
    bottomColor: pickColor(s.bottomColor, clothColors, DEFAULT_LOOK.bottomColor as ClothColor),
    accessories: Array.isArray(s.accessories)
      ? s.accessories.reduce<Accessory[]>(
          (list, a) => (ACCESSORIES.some((x) => x.value === a) && !list.includes(a) ? toggleAccessory(list, a) : list),
          []
        )
      : [],
    strike: pick(s.strike, Object.keys(STRIKES) as Strike[], DEFAULT_LOOK.strike)
  }
}

// Visual sorteado, para quem quer começar de algum lugar.
export function randomLook(): MascotLook {
  const any = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]
  const sex = any<MascotSex>(['male', 'female'])
  return {
    sex,
    build: any(Object.keys(BUILDS) as BodyBuild[]),
    hair: any(HAIR_STYLES.map((h) => h.value)),
    hairColor: any(Object.keys(HAIR_COLORS) as HairColor[]),
    face: any(FACE_SHAPES.map((f) => f.value)),
    eyes: any(EYE_SHAPES.map((e) => e.value)),
    eyeColor: any(Object.keys(EYE_COLORS) as EyeColor[]),
    mouth: any(MOUTH_STYLES.map((m) => m.value)),
    skin: any(Object.keys(SKIN_TONES) as SkinTone[]),
    beard: sex === 'female' ? 'none' : any(BEARD_STYLES.map((b) => b.value)),
    beardColor: 'hair',
    top: any(TOP_STYLES.map((t) => t.value)),
    topColor: any(Object.keys(CLOTH_COLORS) as ClothColor[]),
    bottom: any(BOTTOM_STYLES.map((b) => b.value)),
    bottomColor: any(Object.keys(CLOTH_COLORS) as ClothColor[]),
    // Uns dois acessórios, ou nenhum.
    accessories: Array.from({ length: Math.floor(Math.random() * 3) }, () => any(ACCESSORIES.map((a) => a.value))).reduce<Accessory[]>(
      (list, a) => (list.includes(a) ? list : toggleAccessory(list, a)),
      []
    ),
    strike: any(Object.keys(STRIKES) as Strike[])
  }
}
