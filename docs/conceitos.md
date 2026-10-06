# Conceitos

O vocabulário do produto. Quando um termo aparecer nos outros documentos ou no código,
ele tem o significado daqui.

## Mapa

```
Canvas
└── Área ............................ Trabalho · Freela · Pessoal
    └── Projeto ..................... aponta para uma pasta no disco
        ├── Conversa ................ chat livre com a IA, no contexto do projeto
        │   └── Bloco de subagente .. criado quando a IA lança um subagente
        ├── Instância de agente ◄──── Agente (biblioteca global)
        │   ├── Tarefa
        │   └── Bloco de subagente
        └── Visualizador de código
```

## Definições

**Canvas.** Área de trabalho infinita, com pan e zoom. Guarda a posição, o tamanho e a
cor de tudo o que está nela.

**Área.** Agrupamento de projetos: Trabalho, Freela, Pessoal. Ainda não está decidido se
a área é uma região desenhada no canvas (como os frames do Figma) ou só uma etiqueta com
cor na caixa do projeto (ver [decisoes.md](decisoes.md)).

**Projeto.** Uma pasta no disco representada por uma caixa no canvas. Tem nome, caminho,
cor, área, posição e tamanho. Dentro dele ficam as conversas e as instâncias de agente.

**Conversa.** Chat livre com a IA, rodando na pasta do projeto: o mesmo que abrir o
Claude Code ali e conversar, mas com um chat desenhado pelo app. Aceita texto e imagens
(prints colados). Um projeto pode ter várias conversas abertas ao mesmo tempo.

**Agente (biblioteca global).** Um modelo reutilizável de agente: nome, descrição,
instruções, ferramentas permitidas e modelo de IA. Fica numa biblioteca que vale para
todos os projetos.

**Instância de agente.** Um agente da biblioteca colocado dentro de um projeto para
executar uma tarefa. Funciona como uma conversa, mas já começa com as instruções do
agente e com a tarefa definida.

**Tarefa.** O que a instância deve fazer. É o primeiro prompt dela.

**Bloco de subagente.** Aparece sozinho no canvas quando uma conversa ou instância lança
um subagente. Fica ligado à origem por uma linha e mostra:

- **Input:** o prompt que o subagente recebeu.
- **Atividade:** as ferramentas que ele está usando (ler arquivo, buscar, rodar comando).
- **Output:** o que ele devolveu.
- **Status:** rodando, concluído ou erro; mais duração e, se der, custo.

**Visualizador de código.** Árvore de arquivos e conteúdo de um arquivo do projeto, com
o mesmo destaque de sintaxe do VS Code.

**Conexão.** Linha visual entre dois itens do canvas, como uma conversa e seus
subagentes.

## Como isso já existe no Claude Code

Conferido nesta máquina em 06/10/2026, no Claude Code 2.1.284:

| Conceito | Onde está hoje |
|---|---|
| Projeto | `~/.claude/projects/<caminho-da-pasta>/` (já existem 40) |
| Conversa | `~/.claude/projects/<projeto>/<id-da-sessao>.jsonl` |
| Bloco de subagente | `~/.claude/projects/<projeto>/<id-da-sessao>/subagents/agent-<id>.jsonl`, com campos `agentId`, `parentUuid`, `timestamp` e `message` |
| Agente global | `~/.claude/agents/*.md` (vazio hoje) |
| Agente do projeto | `<pasta-do-projeto>/.claude/agents/*.md` |
| Área | Já está na estrutura de pastas: `~/Desktop/trabalho/` → Trabalho, `~/Desktop/freelas/` → Freela, `~/Desktop/projetos-pessoais/` → Pessoal |

Esses arquivos são formato interno do Claude Code, não uma API pública: podem mudar de
uma versão para outra. Ver [integracao-com-agentes.md](integracao-com-agentes.md).
