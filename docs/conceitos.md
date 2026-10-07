# Conceitos

O vocabulário do produto. Quando um termo aparecer nos outros documentos ou no código,
ele tem o significado daqui.

## Mapa

```
Canvas
└── Grupo ............................ Trabalho - Freela - Pessoal; tem uma conta do Claude
    ├── Pasta ........................ aponta para uma pasta no disco
    │   ├── Conversa ................. chat com o Claude Code naquela pasta
    │   │   └── Subagente ............ aparece embaixo da conversa enquanto roda
    │   ├── Servidor do projeto ...... botão acima da pasta
    │   └── Painel de código ......... árvore de arquivos e editor
    ├── Conversa no canvas ........... a mesma conversa, aberta num bloco
    ├── Conversa sem projeto ......... card que reabre a conversa
    └── Terminal ..................... Claude Code ou shell, numa pasta

Agente (biblioteca) ......... ~/.claude/agents, chamado com @nome em qualquer conversa
Conta ....................... login do Claude; a principal e as adicionadas
```

## Definições

**Canvas.** Área de trabalho infinita, com pan e zoom. Guarda a posição, o tamanho e a
cor de tudo o que está nela. É um só para todos os grupos.

**Grupo.** Região colorida desenhada no canvas, como os frames do Figma, que junta
pastas, terminais e conversas: Trabalho, Freela, Pessoal ou o que a pessoa quiser. Pode
ser recolhido, ter o conteúdo oculto (vira uma área listrada) e se ajustar ao conteúdo. Cada
grupo usa uma conta do Claude. No código o tipo ainda se chama `area` (`AreaNode`): é o
nome antigo, de antes de virar grupo.

**Pasta (projeto).** Uma pasta no disco representada por um bloco no canvas. Mostra o
nome, o caminho, a branch do git e as conversas mais recentes; as demais ficam no painel
"Ver todas as conversas". Recolhida, mostra só as conversas rodando ou esperando você.

**Conversa.** Chat com o Claude Code rodando na pasta: o mesmo que abrir o `claude` ali,
com o mesmo `CLAUDE.md`, configurações e MCPs, mas com um chat desenhado pelo app. Aceita
texto, prints colados, arquivos e ditado. Abre no painel lateral, numa janela própria ou
num bloco dentro do canvas, conforme **Configurações › Geral › Abrir conversas em**. Fica
em um lugar só de cada vez. Status: rodando, esperando você ou concluída.

**Conversa sem projeto.** Criada pelo botão direito do canvas. Roda na pasta do usuário
(`~`) e só entra no canvas no primeiro envio, como um card que reabre a conversa.

**Sessão externa.** Conversa do Claude Code aberta fora do app (terminal, VS Code). O app
lê o histórico e o status dela e mostra na pasta, mas não conversa por ela.

**Agente.** Subagente do Claude Code, em `~/.claude/agents/*.md`: nome, descrição,
instruções, ferramentas e modelo. A biblioteca do app só lê e grava esses arquivos, então
o mesmo agente vale no terminal e no VS Code. Numa conversa, é chamado com `@nome` ou
escolhido pelo próprio Claude pela descrição (ver D10 e D11 em [decisoes.md](decisoes.md)).

**Subagente.** Agente lançado por uma conversa. Enquanto roda, aparece recuado embaixo
dela na pasta, com o nome, o que está fazendo agora e o tempo. O registro completo (pedido,
atividade e o que entregou) fica no chat (D12).

**Terminal.** Bloco no canvas com um terminal real numa pasta, rodando o `claude` ou o
shell do sistema. Pode retomar uma conversa (`claude --resume`).

**Servidor do projeto.** Script `dev` ou `start` do `package.json`, iniciado em segundo
plano pelo botão acima da pasta. A lista de **Servidores rodando** mostra também os que
foram abertos fora do app.

**Painel de código.** Árvore de arquivos e editor da pasta, com a coloração do VS Code e
os arquivos não comitados marcados com a cor do git (D17).

**Conta.** Login do Claude. A principal é a do `~/.claude`, a mesma do terminal e do VS
Code; as outras moram em `~/.argus/accounts/<id>` (D18).

**Memória.** Os `CLAUDE.md` (global e de cada projeto) e as anotações da memória
automática do Claude Code, editáveis pelo app.

### Nomes que saíram

- **Área** virou **grupo**.
- **Instância de agente** e **tarefa**: o agente roda como subagente da conversa, não
  como uma instância à parte com tarefa própria (D11).
- **Bloco de subagente** ligado à origem por uma linha: o subagente aparece embaixo da
  conversa, na própria pasta (D12).
- **Visualizador de código** virou **painel de código**, porque também edita (D17).

## Onde isso está no Claude Code

Conferido em 06/10/2026, no Claude Code 2.1.284, e revisto em 07/10/2026:

| Conceito | Onde está |
|---|---|
| Pasta | `~/.claude/projects/<caminho-da-pasta-achatado>/` (tudo que não é letra ou número vira `-`) |
| Conversa | `~/.claude/projects/<projeto>/<id-da-sessao>.jsonl` |
| Subagente | `~/.claude/projects/<projeto>/<id-da-sessao>/subagents/agent-<id>.jsonl` |
| Status de cada Claude Code aberto | `~/.claude/sessions/<pid>.json` (`busy`, `waiting`, `idle`) |
| Agente global | `~/.claude/agents/*.md` |
| Agente do projeto | `<pasta-do-projeto>/.claude/agents/*.md` |
| Conta adicionada | `~/.argus/accounts/<id>`, passada ao `claude` em `CLAUDE_CONFIG_DIR` |

Esses arquivos são formato interno do Claude Code, não uma API pública: podem mudar de
uma versão para outra. Ver [integracao-com-agentes.md](integracao-com-agentes.md).
