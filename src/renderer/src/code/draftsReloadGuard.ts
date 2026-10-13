import { IS_MAC } from '../platform'
import { hasDrafts } from './drafts'
import { tr } from '../i18n'

// ⌘R recarrega a janela e leva junto os rascunhos do painel de código (eles só existem na
// memória): com algum rascunho, pergunta antes. Fica registrado desde a abertura, no fundo da
// pilha do ⌘R, e por isso a página do protótipo, aberta depois, continua recarregando só ela.
// No Windows não há menu, e o Ctrl+R sem ninguém escutando não recarrega a janela: não há o que
// proteger (e escutar aqui passaria a recarregar a janela).
// A pergunta ao fechar ou atualizar o app fica com o processo principal (drafts.ts avisa a ele).
const QUESTION = tr(
  'Há arquivos com alterações não salvas no painel de código. Recarregar a janela descarta essas alterações. Recarregar mesmo assim?',
  'There are files with unsaved changes in the code panel. Reloading the window discards those changes. Reload anyway?'
)

if (IS_MAC) {
  window.api.onReloadKey(() => {
    if (!hasDrafts() || window.confirm(QUESTION)) location.reload()
  })
}
