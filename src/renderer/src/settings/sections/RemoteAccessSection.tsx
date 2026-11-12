import { useEffect, useState, type ReactNode } from 'react'
import type { RemoteAccessState } from '../../../../shared/remote'
import { LOCALE, tr } from '../../i18n'
import { Button } from '../../ui/Button'
import { Group, Row, Switch } from '../controls'

// Acesso remoto (experimento): usar o Argus deste computador de outro (o notebook no trabalho), ou
// abrir daqui o de outro computador. A ligação passa pela ponte do Argus na internet, cifrada de
// ponta a ponta (ver src/main/remote).

const date = (ms: number) => new Date(ms).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })

function Title({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="mt-6 mb-2 first:mt-0">
      <h3 className="text-[16px] font-medium text-text">{children}</h3>
      <p className="text-[15px] leading-relaxed text-faint">{hint}</p>
    </div>
  )
}

function useRemoteAccess(): RemoteAccessState | null {
  const [state, setState] = useState<RemoteAccessState | null>(null)
  useEffect(() => {
    let alive = true
    void window.api.remoteAccess.state().then((s) => alive && setState(s))
    const off = window.api.remoteAccess.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

// Segundos até o código vencer, contando na tela.
function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  return until ? Math.max(0, Math.round((until - now) / 1000)) : 0
}

function relayText(s: RemoteAccessState): string {
  if (!s.hosting) return tr('Desligado: nenhum outro computador entra.', 'Off: no other computer can connect.')
  if (s.relay === 'online') return tr('Ligado - os aparelhos pareados podem entrar.', 'On - paired devices can connect.')
  if (s.relay === 'connecting') return tr('Ligando à ponte do acesso remoto…', 'Connecting to the remote access relay…')
  return tr('Sem conexão com a ponte. Tentando de novo…', 'No connection to the relay. Retrying…')
}

export function RemoteAccessSection() {
  const state = useRemoteAccess()
  if (!state) return null
  return (
    <>
      <ThisComputer state={state} />
      <Devices state={state} />
      <OtherComputers state={state} />
    </>
  )
}

function ThisComputer({ state }: { state: RemoteAccessState }) {
  const left = useCountdown(state.pairing?.expiresAt ?? null)
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <>
      <Title hint={tr(`Deixe ${state.name} ligado e use o Argus dele de outro computador.`, `Leave ${state.name} on and use its Argus from another computer.`)}>
        {tr('Este computador', 'This computer')}
      </Title>
      <Group>
        <Row label={tr('Permitir acesso de outros computadores', 'Allow access from other computers')} description={relayText(state)}>
          <Switch label={tr('Permitir acesso', 'Allow access')} checked={state.hosting} onChange={(on) => void window.api.remoteAccess.setHosting(on)} />
        </Row>
        <Row
          label={tr('Parear um aparelho', 'Pair a device')}
          description={tr('Gera um código para digitar no outro computador, em Acesso remoto.', 'Generates a code to type on the other computer, under Remote access.')}
          info={tr(
            'O código vale por 10 minutos e para um aparelho só. Errado uma vez, ele deixa de valer. Quem tem o aparelho pareado vê e controla tudo deste Argus: conversas, terminais e arquivos dos projetos.',
            'The code is valid for 10 minutes and for one device only. One wrong try and it stops working. Whoever has the paired device sees and controls all of this Argus: chats, terminals and project files.'
          )}
        >
          {state.pairing ? (
            <Button variant="secondary" onClick={() => window.api.remoteAccess.cancelPairing()}>
              {tr('Cancelar', 'Cancel')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void window.api.remoteAccess.startPairing()}>
              {tr('Gerar código', 'Generate code')}
            </Button>
          )}
        </Row>
        {state.pairing && (
          <div className="flex flex-col items-center gap-1 border-b border-line py-4 last:border-0">
            <span className="font-mono text-[28px] font-semibold tracking-[0.15em] text-text select-all">{state.pairing.code}</span>
            <span className="text-[15px] text-muted">
              {tr(`Digite no outro computador - vence em ${clock}`, `Type it on the other computer - expires in ${clock}`)}
            </span>
          </div>
        )}
        {!state.pairing && state.pairingResult && (
          <p className={`border-b border-line py-3 text-[15px] last:border-0 ${state.pairingResult.ok ? 'text-text' : 'text-red-400'}`}>
            {state.pairingResult.ok ? tr(`${state.pairingResult.name} foi pareado.`, `${state.pairingResult.name} was paired.`) : state.pairingResult.error}
          </p>
        )}
      </Group>
    </>
  )
}

function Devices({ state }: { state: RemoteAccessState }) {
  if (!state.devices.length) return null
  return (
    <>
      <Title hint={tr('Podem entrar neste computador. Remova o que você não usa mais.', 'Can connect to this computer. Remove the ones you no longer use.')}>
        {tr('Aparelhos pareados', 'Paired devices')}
      </Title>
      <Group>
        {state.devices.map((d) => (
          <Row
            key={d.id}
            label={d.name}
            description={
              d.connected
                ? tr('Conectado agora', 'Connected now')
                : d.lastSeen
                  ? tr(`Última vez: ${date(d.lastSeen)}`, `Last seen: ${date(d.lastSeen)}`)
                  : tr(`Pareado em ${date(d.pairedAt)}`, `Paired on ${date(d.pairedAt)}`)
            }
            info={tr(
              'Remover desconecta o aparelho na hora e ele não entra mais. O que já foi feito por ele (comandos nos terminais, arquivos alterados) continua como está.',
              'Removing disconnects the device right away and it can no longer connect. What it already did (terminal commands, changed files) stays as it is.'
            )}
          >
            <Button variant="secondary" danger onClick={() => window.api.remoteAccess.removeDevice(d.id)}>
              {tr('Remover', 'Remove')}
            </Button>
          </Row>
        ))}
      </Group>
    </>
  )
}

function OtherComputers({ state }: { state: RemoteAccessState }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (key: string, job: () => Promise<string | null>) => {
    setBusy(key)
    setError(null)
    try {
      setError(await job())
    } finally {
      setBusy(null)
    }
  }

  const pair = () =>
    run('pair', async () => {
      const result = await window.api.remoteAccess.pair(code)
      if (!result.ok) return result.error
      setCode('')
      return window.api.remoteAccess.open(result.hostId)
    })

  return (
    <>
      <Title hint={tr('Abra aqui o Argus de outro computador, com os projetos de lá.', 'Open here the Argus of another computer, with its projects.')}>
        {tr('Outros computadores', 'Other computers')}
      </Title>
      <Group>
        {state.hosts.map((h) => (
          <Row
            key={h.hostId}
            label={h.name}
            description={h.open ? tr('Aberto numa janela', 'Open in a window') : tr(`Pareado em ${date(h.pairedAt)}`, `Paired on ${date(h.pairedAt)}`)}
          >
            <div className="flex gap-2">
              <Button variant="secondary" danger onClick={() => window.api.remoteAccess.forgetHost(h.hostId)}>
                {tr('Esquecer', 'Forget')}
              </Button>
              <Button variant="primary" disabled={busy !== null} onClick={() => void run(h.hostId, () => window.api.remoteAccess.open(h.hostId))}>
                {busy === h.hostId ? tr('Abrindo…', 'Opening…') : h.open ? tr('Mostrar', 'Show') : tr('Abrir', 'Open')}
              </Button>
            </div>
          </Row>
        ))}
        <Row
          label={tr('Conectar a outro Argus', 'Connect to another Argus')}
          description={tr(
            'No outro computador, em Acesso remoto, clique em "Gerar código" e digite o código aqui.',
            'On the other computer, under Remote access, click "Generate code" and type the code here.'
          )}
          below
        >
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim() && !busy) void pair()
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="K7Q4M-913776"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label={tr('Código de pareamento', 'Pairing code')}
              className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 font-mono text-[16px] text-text uppercase outline-none focus:border-accent"
            />
            <Button type="submit" variant="primary" disabled={!code.trim() || busy !== null}>
              {busy === 'pair' ? tr('Pareando…', 'Pairing…') : tr('Parear', 'Pair')}
            </Button>
          </form>
        </Row>
        {error && <p className="border-b border-line py-3 text-[15px] text-red-400 last:border-0">{error}</p>}
      </Group>
    </>
  )
}
