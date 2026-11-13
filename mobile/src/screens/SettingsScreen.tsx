import { useEffect, useState } from 'react'
import { tr } from '../i18n'
import { useHost, useStatus } from '../lib/host'
import { currentSubscription, disablePush, enablePush, installed, isIos as detectIos, pushSupported } from '../lib/push'
import { back } from '../lib/router'
import { forgetPairedHost } from '../net/connection'
import { Row, Section } from '../ui/List'
import { FLOATING_HEADER_SPACE, FloatingHeader } from '../ui/FloatingHeader'

const isIos = detectIos()

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-green' : 'bg-code'}`}
    >
      <span className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  )
}

export function SettingsScreen() {
  const { conn } = useHost()
  const status = useStatus()
  const [push, setPush] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void currentSubscription().then((s) => setPush(!!s && Notification.permission === 'granted'))
  }, [])
  const canPush = pushSupported() && (!isIos || installed())
  const [testing, setTesting] = useState(false)
  const sendTest = async () => {
    if (testing) return
    setTesting(true)
    setError(null)
    try {
      const result = await conn.testPush()
      setError(
        result === 'sent'
          ? tr('Enviada pelo computador. Deve aparecer em alguns segundos.', 'Sent by the computer. It should show up in a few seconds.')
          : result === 'gone'
            ? tr('A inscrição deste aparelho venceu. Desligue e ligue "Avisar no celular" de novo.', 'This device subscription expired. Turn "Alert on this phone" off and on again.')
            : result === 'none'
              ? tr('O computador não tem a inscrição deste aparelho. Desligue e ligue "Avisar no celular" de novo.', "The computer doesn't have this device's subscription. Turn \"Alert on this phone\" off and on again.")
              : tr('O serviço de notificações recusou. Veja o log do Argus ([remoto web]).', 'The notification service refused. Check the Argus log ([remoto web]).')
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const togglePush = async (on: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        const err = await enablePush(conn)
        setError(err)
        setPush(!err)
      } else {
        await disablePush(conn)
        setPush(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const info = conn.info
  return (
    <div className="min-h-full">
      <FloatingHeader title={tr('Ajustes', 'Settings')} onBack={() => back({ name: 'home' })} backLabel={tr('Início', 'Home')} />
      <div className={`px-safe pb-end ${FLOATING_HEADER_SPACE}`}>
        <Section title={tr('Computador', 'Computer')}>
          <Row title={conn.host.hostName} trailing={status === 'online' ? tr('Conectado', 'Connected') : status === 'connecting' ? tr('Conectando…', 'Connecting…') : tr('Fora do ar', 'Offline')} />
          {info && <Row title={tr('Versão do Argus', 'Argus version')} trailing={info.version} />}
        </Section>

        <Section
          title={tr('Notificações', 'Notifications')}
          footer={
            error ??
            (canPush
              ? tr('Avisa quando uma conversa termina, para com erro ou precisa de você, com o app fechado.', 'Alerts you when a chat finishes, fails or needs you, with the app closed.')
              : isIos
                ? tr('No iPhone, as notificações só funcionam com o app na Tela de Início: toque em Compartilhar e em "Adicionar à Tela de Início", e abra por lá.', 'On iPhone, notifications only work with the app on the Home Screen: tap Share, then "Add to Home Screen", and open it from there.')
                : tr('Este navegador não tem notificações.', 'This browser has no notifications.'))
          }
        >
          <Row title={tr('Avisar no celular', 'Alert on this phone')} trailing={<Toggle on={push} disabled={!canPush || busy || status !== 'online'} onChange={(on) => void togglePush(on)} />} />
          {push && (
            <Row
              title={<span className="text-accent">{testing ? tr('Enviando…', 'Sending…') : tr('Enviar notificação de teste', 'Send a test notification')}</span>}
              chevron={false}
              onClick={() => void sendTest()}
            />
          )}
        </Section>

        <Section footer={tr('Este aparelho deixa de entrar no computador. Para remover dos dois lados, use Configurações > Acesso remoto no Argus.', 'This device stops connecting to the computer. To remove it on both sides, use Settings > Remote access in Argus.')}>
          <Row
            title={tr('Esquecer este computador', 'Forget this computer')}
            danger
            chevron={false}
            onClick={() => {
              if (!confirm(tr('Esquecer este computador? Para entrar de novo, será preciso parear com um código novo.', 'Forget this computer? To connect again you will need a new pairing code.'))) return
              void disablePush(conn).catch(() => {})
              conn.stop()
              forgetPairedHost()
              location.hash = ''
              location.reload()
            }}
          />
        </Section>
      </div>
    </div>
  )
}
