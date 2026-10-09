import type { ChatImage } from '../../../shared/chat'
import type { Design, DesignDevice } from '../../../shared/design'
import { freezeConversationSettings, getConversationSettings } from '../conversation/conversationSettings'

// Protótipo: a tela no código do projeto, escrita por uma conversa do Claude Code na pasta. É uma
// conversa como as outras (aparece na lista da pasta e abre no chat); o drawer mostra a página.


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
- Dispositivo principal: ${deviceText(design.device)}.
- O servidor de desenvolvimento do projeto já roda pelo Argus: não suba outro.
- Assim que souber o endereço da tela, escreva uma linha só com ROTA: /endereço; o app abre a página enquanto você escreve. No fim, termine com a linha TELA: nome curto da tela.
</modo-design>`
}

// Tela que já existe no projeto: o primeiro pedido diz onde ela está e que é para ajustar, não criar.
// `here`: a página em que a pessoa está agora (pode ter navegado a partir da que abriu).
export function existingHint(design: Design, here?: string, page?: PageInView): string {
  const route = here ?? design.route ?? '/'
  return `<modo-design>
Você está no modo design do Argus, ajustando uma tela que já existe neste projeto: a do endereço ${route} no servidor de desenvolvimento.
- Ache os arquivos que desenham essa tela e mude só o que a pessoa pedir. Não crie outra tela nem outra rota, e não reescreva o que não foi pedido.
- Siga a estrutura, a stack e os componentes que o projeto já usa. Se houver CLAUDE.md, skills ou regras de design, siga.
- Dispositivo principal: ${deviceText(design.device)}.
- O servidor de desenvolvimento do projeto já roda pelo Argus: não suba outro.
- Se o endereço da tela mudar, escreva uma linha só com ROTA: /endereço. No fim, termine com a linha TELA: nome curto da tela.
</modo-design>${followHint(page)}`
}

// A página que a pessoa está vendo no drawer: o endereço, o título e a largura (desktop ou celular).
// Vai em todo pedido, para o Claude saber de que tela e de que versão dela se fala (ela pode ter
// navegado ou trocado a largura desde o último pedido).
// `app`: num monorepo, a pasta do app que está na tela (o código da página está nela).
export type PageInView = { path: string; title?: string; url?: string; device: DesignDevice; state?: string | null; app?: string }

const pageLine = (page: PageInView | undefined) =>
  page
    ? `\nA pessoa está vendo agora, no drawer do Argus, a página ${page.path}${page.title ? ` (título "${page.title}")` : ''}${page.url ? `, aberta em ${page.url}` : ''}${page.app ? `, do app da pasta ${page.app} (o projeto sobe vários apps; o código desta página está nessa pasta)` : ''}, na largura de ${deviceText(page.device)}. Quando ela disser "esta tela" ou "aqui", é esta página nessa largura: ache no código o componente da rota ${page.path}, e o que ela pedir vale para essa largura (no celular, mude o layout responsivo sem estragar o desktop, e vice-versa).${
        page.state
          ? `\nO que está na tela agora (lido da página na hora do pedido; use para entender do que ela fala, mesmo que o pedido seja vago):\n${page.state}`
          : ''
      }`
    : ''

// Pedido seguinte: a página que a pessoa está vendo e o lembrete do endereço.
export function followHint(page?: PageInView): string {
  return `<modo-design>${pageLine(page)}
Se o endereço da tela mudar, escreva a linha ROTA: /endereço.
</modo-design>`
}

// Marca do que foi junto do pedido (os comentários na página): o chat a lê do histórico e mostra
// discreta no balão (ver marksOf, em history.ts).
export const markOf = (kind: 'comentarios', text: string): string =>
  `\n<argus-marca tipo="${kind}">${text.replace(/[<>\n]/g, ' ').slice(0, 120)}</argus-marca>`

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
// A resposta como a pessoa lê: sem as linhas ROTA e TELA, que são recado para o app.
export const withoutAppLines = (text: string) => text.replace(/^\s*(ROTA|TELA):.*$\n?/gm, '').trimEnd()
export const nameIn = (text: string) => last(text, /^\s*TELA:\s*(.+?)\s*$/gm)?.slice(0, 60)
