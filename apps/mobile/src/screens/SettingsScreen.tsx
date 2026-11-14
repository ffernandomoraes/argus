import { useState } from 'react';
import { tr } from '../i18n';
import { useHost, useStatus } from '../lib/host';
import { forgetPush } from '../lib/push';
import { forgetPairedHost } from '../net/connection';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Row, Section } from '../ui/List';
import { TabHeader } from '../ui/TabBar';
import { UsageSection } from '../ui/UsageSummary';
import { NotificationsSection } from './NotificationsSection';
import { PreferencesSection } from './PreferencesSection';

// Aba Conta: o uso das contas, as preferências, o computador pareado, as notificações e esquecer o
// computador.
export function SettingsScreen() {
  const { conn } = useHost();
  const status = useStatus();
  const info = conn.info;
  const [asking, setAsking] = useState(false);
  const forget = () => {
    void forgetPush(conn).catch(() => {});
    conn.stop();
    forgetPairedHost();
    location.hash = '';
    location.reload();
  };
  return (
    <div className="min-h-full">
      <div className="px-safe pb-tabs">
        <TabHeader title={tr('Conta', 'Account')} />
        <UsageSection />
        <PreferencesSection />

        <Section title={tr('Computador', 'Computer')}>
          <Row title={conn.host.hostName} trailing={status === 'online' ? tr('Conectado', 'Connected') : status === 'connecting' ? tr('Conectando…', 'Connecting…') : tr('Fora do ar', 'Offline')} />
          {info && <Row title={tr('Versão do Argus', 'Argus version')} trailing={info.version} />}
        </Section>

        <NotificationsSection />

        <Section footer={tr('Este aparelho deixa de entrar no computador. Para remover dos dois lados, use Configurações > Acesso remoto no Argus.', 'This device stops connecting to the computer. To remove it on both sides, use Settings > Remote access in Argus.')}>
          <Row
            title={tr('Esquecer este computador', 'Forget this computer')}
            danger
            chevron={false}
            onClick={() => setAsking(true)}
          />
        </Section>
        <p className="mt-10 text-center text-[12px] text-faint">{tr(`Versão ${__APP_VERSION__}`, `Version ${__APP_VERSION__}`)}</p>
      </div>
      <ConfirmSheet
        open={asking}
        title={tr('Esquecer este computador?', 'Forget this computer?')}
        message={tr('Para entrar de novo, será preciso parear com um código novo.', 'To connect again you will need a new pairing code.')}
        confirmLabel={tr('Esquecer', 'Forget')}
        danger
        onConfirm={forget}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}
