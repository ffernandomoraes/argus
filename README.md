# Canva Agent Editor (nome provisório)

App desktop para **orquestrar vários projetos e os agentes de IA que trabalham neles**,
num canvas infinito. Cada projeto é uma caixa; dentro dela eu converso com a IA, coloco
agentes para executar tarefas e vejo, em tempo real, o que cada agente e subagente está
fazendo: o que recebeu, o que está executando e o que devolveu.

- **Plataforma:** desktop. macOS primeiro, Windows depois.
- **Status:** esqueleto do app rodando (canvas com áreas e projetos de exemplo).
- **Stack:** Electron + React + TypeScript (electron-vite, React Flow, Tailwind).
- **Próximo passo:** montar a interface no próprio app → prova técnica da integração com o Claude.

## Rodar

```bash
pnpm install
pnpm dev
```

## Documentos

| Arquivo | O que tem |
|---|---|
| [docs/visao.md](docs/visao.md) | Problema, ideia, princípios e o pedido original |
| [docs/conceitos.md](docs/conceitos.md) | Vocabulário do produto: área, projeto, conversa, agente, instância, bloco |
| [docs/funcionalidades.md](docs/funcionalidades.md) | O que o app faz, separado por fase |
| [docs/integracao-com-agentes.md](docs/integracao-com-agentes.md) | Como o app conversa com o Claude e opções de stack |
| [docs/decisoes.md](docs/decisoes.md) | O que já foi decidido e o que está em aberto |
