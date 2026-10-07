# Funcionalidades

O plano saiu em fases, e cada uma tinha que funcionar sozinha antes da próxima. Abaixo, o
que foi planejado e como está hoje (07/10/2026, versão 0.1.11). Para a lista do que o app
faz, do ponto de vista de quem usa, ver o [README](../README.md#funcionalidades).

Legenda: **feito**, **mudou** (entrou de outro jeito), **falta**.

## Fase 0: Wireframe

Substituída por D8: a interface foi montada direto no app.

## Fase 1: Canvas e projetos

| Item | Status |
|---|---|
| Canvas infinito com pan e zoom | feito, com minimapa e "Ver tudo" |
| Caixas de projeto: arrastar, redimensionar, mudar cor | feito, com encaixe nos vizinhos e desfazer/refazer |
| Áreas Trabalho, Freela e Pessoal | mudou: viraram **grupos** livres, com nome, cor e conta do Claude próprios |
| Adicionar projeto a partir de uma pasta | feito: **Nova pasta** no canvas e `argus .` no terminal |
| Importar os projetos que o Claude Code já conhece | falta |
| Layout salvo e restaurado ao reabrir | feito |

## Fase 2: Conversar

| Item | Status |
|---|---|
| Conversa dentro de um projeto, naquela pasta | feito, no painel lateral, em janela ou num bloco do canvas |
| Colar prints com ⌘V, miniaturas antes de enviar | feito, mais arquivos anexados e ditado |
| Usar a assinatura já logada na máquina | feito, com login dentro do app e várias contas |
| Resposta em tempo real | feito |
| Ferramentas usadas, resumidas e expansíveis | feito, com o diff de cada edição |
| Aprovar ou negar permissões no chat | feito, mais as perguntas do Claude |
| Parar a IA no meio | feito |
| Várias conversas em vários projetos ao mesmo tempo | feito |
| "Esperando você" visível com o canvas afastado | feito, mais notificação do sistema e ícone na barra de menus |

## Fase 3: Agentes e subagentes

| Item | Status |
|---|---|
| Biblioteca global de agentes: criar, editar, duplicar | feito, com o Claude escrevendo as instruções |
| Instanciar um agente num projeto com uma tarefa | mudou: o agente roda como subagente da conversa, chamado com `@nome` (D11) |
| Bloco de subagente ligado à origem | mudou: o subagente aparece embaixo da conversa enquanto roda e o registro fica no chat (D12) |
| Ver sessões iniciadas fora do app | feito, com o status de cada uma |

## Fase 4: Código

| Item | Status |
|---|---|
| Árvore de arquivos e edição (CodeMirror, cores do VS Code) | feito, com criar, renomear, excluir, copiar e colar (D17) |
| Ver o que o agente mudou (diff) | feito, no chat, a cada edição |
| Botão "abrir no VS Code" | falta |

## Entrou sem estar no plano

- Terminais embutidos (Claude Code ou shell) no canvas.
- Barra de comando por texto ou voz, que organiza o canvas.
- Botão para iniciar e encerrar o servidor do projeto e lista dos servidores rodando.
- Indicador de limite de uso, por conta.
- Anel de uso da janela de contexto em cada conversa.
- Editor da memória do Claude (`CLAUDE.md` e memória automática).
- Comandos de barra, painel de MCPs e remote control no chat.
- Instalador, atualização automática e release a cada push (D15, D16, D20).
- Confirmação antes de fechar ou atualizar com conversa ou terminal rodando.

## Depois

| Item | Status |
|---|---|
| Windows | falta |
| Terminal embutido | feito |
| Notificações quando um agente termina ou precisa de resposta | feito |
| Conexões entre projetos | falta |
| Custo e uso de tokens por projeto e por grupo | falta (existe o limite de uso por conta, não o custo por projeto) |
| Busca global em conversas | falta |
| Outros agentes além do Claude (Codex, Gemini CLI) | falta, ver P11 em [decisoes.md](decisoes.md) |
