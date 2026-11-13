import { ConfirmDialog } from '../canvas/ConfirmDialog'
import { tr } from '../i18n'
import { Presence } from '../motion'
import { IS_REMOTE } from '../remote'
import { useAuth } from './useAuth'

// Duas contas do app estavam com o mesmo login do Claude e viraram uma (ver mergeTwins em
// main/auth): o aviso diz qual ficou, até a pessoa fechar. Na janela de acesso remoto não aparece:
// as contas são as do outro computador, e o aviso é de lá.
export function MergedAccountsNotice() {
  const notice = useAuth()?.mergeNotice
  const removed = notice?.removed.map((name) => `"${name}"`).join(tr(' e ', ' and ')) ?? ''
  return (
    <Presence kind="modal">
      {notice && !IS_REMOTE && (
        <ConfirmDialog
          request={{
            title: tr('Contas repetidas viraram uma', 'Duplicate accounts were merged'),
            description: tr(
              `${removed} e "${notice.kept}" estavam com o mesmo login do Claude. Ficou só "${notice.kept}": os grupos e as conversas que usavam a outra passam a usar ela.`,
              `${removed} and "${notice.kept}" were signed in to the same Claude account. Only "${notice.kept}" stays: groups and chats that used the other one now use it.`
            )
          }}
          onClose={() => window.api.auth.dismissMergeNotice()}
        />
      )}
    </Presence>
  )
}
