<p align="center">
  <img src="build/icon.png" width="128" alt="Ícone do Argus">
</p>

<h1 align="center">Argus</h1>

<p align="center">
  Um canvas infinito para acompanhar todos os seus projetos e as conversas do Claude Code ao mesmo tempo.
</p>

<p align="center">
  <a href="https://github.com/ffernandomoraes/argus/releases/latest"><b>Baixar para macOS (Apple Silicon)</b></a>
</p>

![Canvas do Argus com projetos agrupados em Trabalho e Pessoal](docs/prints/canvas.png)

Na mitologia grega, Argus era o gigante de cem olhos que via tudo ao mesmo tempo. O app faz
o mesmo com os seus agentes: cada pasta de projeto vira um bloco no canvas e, dentro dele,
você vê as conversas do Claude Code, o que cada uma está fazendo agora e quais estão
esperando por você.

![Conversa aberta no painel lateral, com o diff da edição feita pelo Claude](docs/prints/conversa.png)

## Funcionalidades

**Canvas**
- Canvas infinito com zoom, minimapa e grupos coloridos (Trabalho, Pessoal, o que você quiser).
- Cada pasta de projeto vira um bloco com a branch do git e as conversas mais recentes.
- O layout fica salvo e volta igual ao reabrir o app.
- Comando `argus .` no terminal: abre a pasta atual no canvas, como o `code .` do VS Code.
- Barra de comando por texto ou voz: peça "cria um grupo Freela com essas duas pastas" e o Claude organiza o canvas.

**Conversas com o Claude Code**
- Chat completo no painel lateral ou em janela própria, com respostas em tempo real.
- Cole prints com ⌘V, anexe arquivos e dite em vez de digitar.
- Edições aparecem como diff (o antes e depois de cada arquivo).
- Aprove ou negue permissões e responda às perguntas do Claude direto no chat.
- Troque modelo, nível de esforço e modo de permissão por conversa.
- Comandos de barra (`/`), painel de servidores MCP e remote control.
- Anel com o quanto da janela de contexto a conversa já ocupa.
- Também enxerga as sessões abertas fora do app (terminal, VS Code) e o status delas.

**Acompanhamento**
- Atualização automática, com a versão em uso sempre no canto da barra de título.
- Status de cada conversa no canvas: rodando, esperando você, concluída.
- Notificação do sistema quando uma conversa termina ou precisa de resposta.
- Ícone na barra de menus com o resumo do que está rodando.
- Indicador do limite de uso do Claude.
- Lista dos servidores locais que algum agente deixou rodando, com atalho para abrir ou encerrar.

**Ferramentas**
- Terminais embutidos (Claude Code ou shell) soltos no canvas.
- Explorador de arquivos e editor de código do projeto: criar, renomear, excluir, colar arquivos copiados no Finder e editar com ⌘S para salvar.
- Biblioteca de agentes (subagentes do Claude Code): criar, editar e deixar o Claude escrever as instruções.
- Editor da memória do Claude: `CLAUDE.md` global, de cada projeto e as anotações da memória automática.

## Requisitos

- Mac com Apple Silicon (M1 ou mais novo).
- [Claude Code](https://docs.claude.com/claude-code) instalado e com login feito. O Argus usa o `claude` da sua máquina e a sua assinatura.

## Instalação

### Pelo terminal (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/ffernandomoraes/argus/main/install.sh | sh
```

Baixa a última versão, coloca em `/Applications` e abre. Rodar de novo atualiza.

### Atualizações

O Argus se atualiza sozinho: procura versão nova ao abrir e a cada 5 horas, e baixa em
segundo plano. Quando ela está pronta, aparece **Atualizar para x.y.z** no canto direito da
barra de título. Um clique reinicia o app já atualizado; se preferir não clicar, a versão
nova entra quando você fechar o app. Também dá para procurar na hora pelo menu
**Argus › Procurar atualizações…** ou em **Configurações › Geral**.

As permissões que você der ao app (microfone, ditado, notificações) continuam valendo nas
versões seguintes: todas saem assinadas com o mesmo certificado, e o app só aceita uma
atualização assinada por ele.

### Pelo .dmg

1. Baixe o `Argus-<versão>-arm64.dmg` em [Releases](https://github.com/ffernandomoraes/argus/releases/latest).
2. Arraste o Argus para a pasta Aplicativos.
3. Na primeira vez, o macOS bloqueia a abertura, porque o app não é notarizado pela Apple.
   Vá em **Ajustes do Sistema › Privacidade e Segurança** e clique em **Abrir Mesmo Assim**.

### Comando `argus`

Em **Configurações › Geral**, ative o comando `argus` no terminal. Depois, em qualquer pasta:

```bash
argus .
```

## Desenvolvimento

```bash
pnpm install   # também compila o ditado (precisa das Command Line Tools da Apple)
pnpm dev       # abre o app com recarga automática
pnpm typecheck
pnpm dist      # gera o .dmg e o .zip em dist/
```

Stack: Electron, React, TypeScript, electron-vite, React Flow, Tailwind e o
[Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview).

### Gerar uma versão

Pela aba **Actions › Release › Run workflow**, ou:

```bash
gh workflow run release.yml -f bump=patch   # ou minor, major
```

O workflow sobe a versão no `package.json`, cria a tag, monta o `.dmg` e o `.zip` e
publica o release.

## Documentos

| Arquivo | O que tem |
|---|---|
| [docs/visao.md](docs/visao.md) | Problema, ideia, princípios e o pedido original |
| [docs/conceitos.md](docs/conceitos.md) | Vocabulário do produto: área, projeto, conversa, agente, instância, bloco |
| [docs/funcionalidades.md](docs/funcionalidades.md) | Planejamento das funcionalidades, por fase |
| [docs/integracao-com-agentes.md](docs/integracao-com-agentes.md) | Como o app conversa com o Claude |
| [docs/decisoes.md](docs/decisoes.md) | O que já foi decidido e o que está em aberto |

---

Projeto pessoal, sem vínculo com a Anthropic. Claude e Claude Code são marcas da Anthropic.
