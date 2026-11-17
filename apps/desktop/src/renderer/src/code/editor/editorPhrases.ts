import { EditorState } from '@codemirror/state';
import { tr } from '../../i18n';

// Textos dos painéis do CodeMirror (localizar e substituir, ir para a linha) no idioma do app.
export const editorPhrases = EditorState.phrases.of({
  'Find': tr('Localizar', 'Find'),
  'Replace': tr('Substituir', 'Replace'),
  'next': tr('próximo', 'next'),
  'previous': tr('anterior', 'previous'),
  'all': tr('todos', 'all'),
  'match case': tr('maiúsculas', 'match case'),
  'by word': tr('palavra inteira', 'by word'),
  'regexp': tr('expressão regular', 'regexp'),
  'replace': tr('substituir', 'replace'),
  'replace all': tr('substituir todos', 'replace all'),
  'close': tr('fechar', 'close'),
  'current match': tr('achado atual', 'current match'),
  'replaced $ matches': tr('$ substituições', 'replaced $ matches'),
  'replaced match on line $': tr('substituído na linha $', 'replaced match on line $'),
  'on line': tr('na linha', 'on line'),
  'Go to line': tr('Ir para a linha', 'Go to line'),
  'go': tr('ir', 'go'),
});
