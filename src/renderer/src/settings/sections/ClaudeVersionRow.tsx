import type { ClaudeBinary, ClaudeVersionState } from '../../../../shared/claudeVersion'
import { useClaudeVersion } from '../../claudeVersion/useClaudeVersion'
import { Button } from '../../ui/Button'
import { Row } from '../controls'
import { tr } from '../../i18n'

const where = (b: ClaudeBinary) =>
  b.source === 'editor' ? tr(`${b.path} (extensão do editor)`, `${b.path} (editor extension)`) : b.path

// Frase curta embaixo do rótulo: a versão, se há uma mais nova e o erro da atualização, que
// precisa ficar à vista.
function describe(s: ClaudeVersionState): string {
  if (!s.current) return s.checking ? tr('Conferindo a versão…', 'Checking the version…') : tr('Nenhum Claude Code achado.', 'No Claude Code found.')
  const version = s.current.version ?? '?'
  const parts = [tr(`Versão ${version}.`, `Version ${version}.`)]
  if (s.outdated) parts.push(tr(`A ${s.latest} já saiu.`, `${s.latest} is out.`))
  else if (s.latest) parts.push(tr('É a mais recente.', 'It’s the latest.'))
  if (s.error) parts.push(tr(`A atualização falhou: ${s.error}`, `The update failed: ${s.error}`))
  return parts.join(' ')
}

// O resto vai no ícone de detalhes: onde está, por que atualizar e as outras cópias.
function details(s: ClaudeVersionState): string | undefined {
  if (!s.current) return undefined
  const parts = [tr(`O Argus usa o de ${where(s.current)}.`, `Argus uses the one at ${where(s.current)}.`)]
  if (s.outdated) parts.push(tr('Os modelos novos só aparecem depois de atualizar.', 'New models only show up after updating.'))
  // Mais de um instalado: o app usa o mais novo, e os outros ficam à vista para quem estranhar. As
  // cópias das extensões (uma por versão do editor) entram só na conta.
  const installed = s.others.filter((o) => o.source === 'system')
  const editors = s.others.length - installed.length
  if (installed.length) {
    const list = installed.map((o) => `${o.version ?? '?'} - ${o.path}`).join('; ')
    parts.push(tr(`Também instalado (sem uso): ${list}.`, `Also installed (unused): ${list}.`))
  }
  if (editors) parts.push(tr(`Mais ${editors} em extensões de editor, sem uso.`, `${editors} more in editor extensions, unused.`))
  return parts.join(' ')
}

// O `claude` que o app usa (o mais novo da máquina) e a versão dele. Atrás da publicada, o botão
// roda o `claude update`.
export function ClaudeVersionRow() {
  const state = useClaudeVersion()
  if (!state) return null
  return (
    <Row label="Claude Code" description={describe(state)} info={details(state)}>
      {state.outdated ? (
        <Button disabled={state.updating} onClick={() => void window.api.claudeVersion.update()}>
          {state.updating ? tr('Atualizando…', 'Updating…') : tr('Atualizar', 'Update')}
        </Button>
      ) : (
        <Button disabled={state.checking || state.updating} onClick={() => void window.api.claudeVersion.check()}>
          {tr('Procurar', 'Check')}
        </Button>
      )}
    </Row>
  )
}
