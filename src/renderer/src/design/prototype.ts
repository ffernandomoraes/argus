import type { ChatImage } from '../../../shared/chat'
import type { Design, DesignDevice } from '../../../shared/design'
import { freezeConversationSettings, getConversationSettings } from '../conversation/conversationSettings'

// Protótipo: a tela no código do projeto, escrita por uma conversa do Claude Code na pasta. É uma
// conversa como as outras (aparece na lista da pasta e abre no chat); o drawer mostra a página.

// Parte da página escolhida com o seletor (designPicker.ts, no processo principal). Com `section`,
// é um elemento (campo, botão, texto...) dentro dessa seção.
export type PrototypePick = { name: string; secao: string | null; section: string | null; text: string; html: string }

// Conversa do protótipo: pela sessão, quando já tem; antes disso, por uma chave fixa do design.
export const draftKeyOf = (design: Design) => `design-${design.id}`
export const chatKeyOf = (design: Design) => design.sessionId ?? draftKeyOf(design)

const deviceText = (device: DesignDevice) =>
  device === 'mobile' ? 'celular (390px de largura)' : 'desktop (1280px de largura)'

// Instruções do modo design. Começam com "<": o chat do app não as mostra como mensagem sua (ver
// promptText, em history.ts), e o título da conversa continua sendo o pedido.
// Protótipo do zero: o primeiro pedido descreve a tela, e o Claude a cria no projeto.
export function startHint(design: Design): string {
  return `<modo-design>
Você está no modo design do Argus, fazendo um protótipo: esta tela vira código de verdade deste projeto.
- Coloque a tela onde ela ficaria de verdade (a rota ou página certa), seguindo a estrutura, a stack e os componentes que o projeto já usa. Se houver CLAUDE.md, skills ou regras de design, siga.
- Marque o elemento raiz de cada seção da tela com data-secao="Nome curto", em português (topo, filtros, lista...). É por ele que a pessoa escolhe a parte que quer mudar.
- Dispositivo principal: ${deviceText(design.device)}.
- O servidor de desenvolvimento do projeto já roda pelo Argus: não suba outro.
- Assim que souber o endereço da tela, escreva uma linha só com ROTA: /endereço; o app abre a página enquanto você escreve. No fim, termine com a linha TELA: nome curto da tela.
</modo-design>`
}

// Tela que já existe no projeto: o primeiro pedido diz onde ela está e que é para ajustar, não criar.
// `here`: a página em que a pessoa está agora (pode ter navegado a partir da que abriu).
export function existingHint(design: Design, pick: PrototypePick | null, here?: string): string {
  const route = here ?? design.route ?? '/'
  return `<modo-design>
Você está no modo design do Argus, ajustando uma tela que já existe neste projeto: a do endereço ${route} no servidor de desenvolvimento.
- Ache os arquivos que desenham essa tela e mude só o que a pessoa pedir. Não crie outra tela nem outra rota, e não reescreva o que não foi pedido.
- Siga a estrutura, a stack e os componentes que o projeto já usa. Se houver CLAUDE.md, skills ou regras de design, siga.
- Dispositivo principal: ${deviceText(design.device)}.
- O servidor de desenvolvimento do projeto já roda pelo Argus: não suba outro.
- Se o endereço da tela mudar, escreva uma linha só com ROTA: /endereço. No fim, termine com a linha TELA: nome curto da tela.
</modo-design>${followHint(route, pick)}`
}

// Pedido seguinte: a parte escolhida na página, se houver, e o lembrete do endereço.
export function followHint(route: string | undefined, pick: PrototypePick | null): string {
  const where = route ? ` (rota ${route})` : ''
  const what = !pick
    ? ''
    : pick.section
      ? `um elemento (${pick.name}) dentro da seção ${pick.secao ? `data-secao="${pick.secao}"` : `<${pick.section}>`}`
      : pick.secao
        ? `a seção data-secao="${pick.secao}"`
        : `um <${pick.name}>`
  const part = pick
    ? `\nA pessoa escolheu esta parte da tela${where}: ${what}${pick.text ? `, com o texto "${pick.text}"` : ''}. HTML como está na página:\n${pick.html}\nMude só essa parte, mantendo o resto.`
    : ''
  return `<modo-design>${part}
Se o endereço da tela mudar, escreva a linha ROTA: /endereço.
</modo-design>`
}

export function sendPrototype(opts: {
  design: Design
  cwd: string
  account?: string
  text: string
  images: ChatImage[]
  hint: string
}): void {
  const key = chatKeyOf(opts.design)
  const settings = getConversationSettings(key)
  // Como na conversa: o que valia no envio fica guardado nela.
  freezeConversationSettings(key, settings)
  window.api.chat.send({
    key,
    cwd: opts.cwd,
    account: opts.account,
    sessionId: opts.design.sessionId,
    settings,
    text: opts.text,
    images: opts.images,
    hint: opts.hint
  })
}

// Linhas que o Claude escreve para o app; vale a última de cada.
const last = (text: string, re: RegExp) => [...text.matchAll(re)].at(-1)?.[1]
export const routeIn = (text: string) => last(text, /^\s*ROTA:\s*(\/\S*)\s*$/gm)
// Todas as rotas que o Claude já informou na conversa, sem repetir.
export const routesIn = (text: string) => [...new Set([...text.matchAll(/^\s*ROTA:\s*(\/\S*)\s*$/gm)].map((m) => m[1]))]
export const nameIn = (text: string) => last(text, /^\s*TELA:\s*(.+?)\s*$/gm)?.slice(0, 60)
