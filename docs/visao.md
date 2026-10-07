# Visão

## O problema

> Interpretação a partir do pedido original (no fim deste arquivo). Corrigir se não for isso.

O trabalho hoje é quase todo feito com IA, em vários projetos ao mesmo tempo e em três
frentes: trabalho, freelas e projetos pessoais. Cada conversa com um agente fica presa
num terminal ou numa aba do editor, então:

- não há visão de conjunto: que projetos estão ativos, que agente está fazendo o quê,
  qual parou esperando resposta;
- quando um agente lança um subagente, o que ele recebeu e devolveu fica escondido;
- não dá para conversar com vários projetos lado a lado.

## A ideia

> A ideia como foi pensada no começo. Parte dela mudou na construção (áreas viraram grupos,
> a instância de agente virou subagente da conversa): ver [conceitos.md](conceitos.md).

Um app desktop com um **canvas infinito**: área de trabalho sem bordas, com pan e zoom,
no estilo Figma ou Miro. Nele:

1. Cada **projeto** é uma caixa que eu posiciono, redimensiono e pinto como quiser.
2. Os projetos ficam separados por **área**: Trabalho, Freela e Pessoal.
3. Dentro de um projeto eu trabalho de dois jeitos:
   - **Conversa livre:** um chat normal com a IA, no contexto daquele projeto.
   - **Instância de agente:** pego um agente da minha **biblioteca global**, crio uma
     instância dele dentro do projeto e passo uma tarefa para ele executar.
4. Quando um agente lança um subagente, aparece no canvas um **bloco** ligado a ele,
   mostrando o input, a atividade e o output.
5. Consigo conversar com vários projetos **ao mesmo tempo**, sem trocar de janela.
6. Consigo **ver o código** do projeto sem sair do app, como no VS Code.

## Princípios

- **A conversa é o centro.** Escrever um prompt, colar prints e acompanhar a resposta tem
  que ser rápido, fluido e agradável. É a ação mais frequente do app.
- **Na assinatura do Claude.** O app usa o login do Claude que já existe na máquina, sem
  chave de API paga por uso.
- **Tudo visível.** Nada que um agente faz fica escondido: entrada, ferramentas usadas,
  saída.
- **Espacial e pessoal.** A organização é minha: eu arrasto, agrupo e pinto, e o app
  guarda.
- **Interligado.** Projetos, conversas, agentes e subagentes se conectam visualmente.
- **Começar pequeno.** Cada fase tem que ser útil sozinha antes de partir para a próxima.

## O que não é (por enquanto)

- Não é um app web nem um SaaS: roda local, na minha máquina.
- Não substitui o VS Code. Ver, navegar e fazer edições simples no código, sim (D17). Virar
  uma IDE completa, não, pelo menos no começo (ver [decisoes.md](decisoes.md)).
- Não é multiusuário.

<details>
<summary>Pedido original (06/10/2026, transcrito por voz)</summary>

**Mensagem 1**

> Seguinte, vamos começar um novo projeto aqui. E esse projeto, ele nada mais é do que um
> editor barra canva barra orquestrador de agentes para que eu controle múltiplos
> projetos, consiga ver tudo que você mesmo está fazendo, né? Então, quando você lança um
> subagente, ele meio que cria ali dentro do próprio Canva um bloquinho onde eu consiga
> ver o que o agente está fazendo, o seu output, o seu input e tudo mais. É, basicamente,
> é para ser um, um projeto de trabalho. Só que ele não vai rodar na web, ele tem que
> rodar no desktop, ou seja, no macOS ou no Windows. Inicialmente, vamos focar só no
> macOS, porque eu tenho macOS. Mas, enfim, a ideia desse projeto é que eu consiga criar
> múltiplas instâncias, ou seja, múltiplos projetos abertos, onde eu consiga interagir
> dentro do próprio Canva com esses múltiplos projetos ao mesmo tempo. Esse Canva ele
> pode ser infinito, onde eu consiga arrastar e soltar as coisas onde eu quiser. Eu
> consiga também mudar a cor, por exemplo, da caixinha do projeto. [...] E antes de sair
> fazendo qualquer coisa, vamos fazer um protótipo, um wireframe, antes de sair
> codificando. Até porque a gente vai mexer com não sei qual linguagem ainda, você vai me
> recomendar daqui a pouco. Mas a ideia é que eu consiga olhar para esse Canva, eu
> consiga dividir o que é projeto pessoal, o que é projeto do trabalho, o que é um
> freelancer. E tem mais. Imagine que eu tenho agentes de forma global e eu consiga criar
> instâncias de agentes para inserir em algum projeto, seja ele do trabalho, seja
> freelancer ou o que for. Entendeu? Então é para ser bem dinâmico esse Canva, é para ser
> bem uma coisa interligando na outra, eu consegui também, de repente, ver o código igual
> o VS Code faz, etc. É bem completo mesmo. Mas vamos começar aos poucos.

**Mensagem 2**

> É, e tem outro ponto. Basicamente, a gente só trabalha com IA agora. Então, a parte de
> você inserir um prompt dentro de uma instância ali de um projeto onde um agente tem que
> ser muito legal. Tem que ser muito dinâmica. As conversas. Entendeu? Então,
> basicamente, é um Canva com múltiplas instâncias que são projetos. Onde também eu posso
> criar um chat normal conversar com a instância. Ou eu posso atrelar um agente que é uma
> instância global. Instanciar uma instância do agente e colocar dentro desse projeto
> para executar certa tarefa. E assim vai, entendeu? É bem dinâmico mesmo.

**Mensagem 3**

> Não, tem que ter um, um chat aqui, porque eu preciso colar prints, principalmente
> preciso colar prints. Entendeu? E aí tudo vai ser integrado ao cloud mesmo, a
> assinatura do cloud, enfim.

*("cloud" = Claude, erro da transcrição por voz.)*

</details>
