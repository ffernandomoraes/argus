import { describe, expect, it } from 'vitest';
import { splitQuestion } from './questionText';

describe('splitQuestion', () => {
  it('separa a lista numerada escrita numa linha só', () => {
    const text =
      'O processo depois do envio é este? 1) a pessoa preenche (~10 min) → 2) vira uma tarefa no Jira → ' +
      '3) a liderança revisa → 4) a pessoa acompanha pela tarefa no Jira. Tirei isso da tela de sucesso.';
    expect(splitQuestion(text)).toEqual({
      intro: 'O processo depois do envio é este?',
      items: [
        'a pessoa preenche (~10 min)',
        'vira uma tarefa no Jira',
        'a liderança revisa',
        'a pessoa acompanha pela tarefa no Jira',
      ],
      outro: 'Tirei isso da tela de sucesso.',
    });
  });

  it('aceita "1." e itens já em linhas separadas', () => {
    expect(splitQuestion('Qual ordem?\n1. login\n2. cadastro')).toEqual({
      intro: 'Qual ordem?',
      items: ['login', 'cadastro'],
      outro: '',
    });
  });

  it('devolve null sem lista ou com número solto', () => {
    expect(splitQuestion('Usar a versão 1.5 ou a 2?')).toBeNull();
    expect(splitQuestion('Só o passo 1) importa?')).toBeNull();
    expect(splitQuestion('Pergunta simples?')).toBeNull();
  });
});
