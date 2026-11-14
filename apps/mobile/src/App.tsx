import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { HostProvider } from './lib/host';
import { setCacheScope } from './lib/cache';
import { ConnectionOverlay } from './ui/ConnectionOverlay';
import { parseRoute, useHash } from './lib/router';
import { HostConnection, loadPairedHost, type PairedHost } from './net/connection';
import { ChatScreen } from './screens/ChatScreen';
import { FolderScreen } from './screens/FolderScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PairScreen } from './screens/PairScreen';
import { InstallScreen } from './screens/InstallScreen';
import { needsInstall, syncPush } from './lib/push';
import { NotificationsStep, usePushStep } from './screens/NotificationsStep';
import { AddFolderScreen } from './screens/AddFolderScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TabBar, isTab } from './ui/TabBar';
import { ApplyPreferences } from './lib/usePreferences';
import { UsageScreen } from './screens/UsageScreen';

function Connected({ host }: { host: PairedHost }) {
  const conn = useMemo(() => {
    // O guardado no aparelho é por computador: escolhido antes de qualquer tela ler.
    setCacheScope(host.hostId);
    return new HostConnection(host);
  }, [host]);
  useEffect(() => {
    conn.start();
    const visibility = () => conn.setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', visibility);
      conn.stop();
    };
  }, [conn]);
  // Cada conexão pronta leva de novo a inscrição das notificações (ver syncPush).
  useEffect(() => conn.onStatus(() => conn.status === 'online' && void syncPush(conn).catch(() => {})), [conn]);
  const [pushStep, pushStepDone] = usePushStep();
  const route = parseRoute(useHash());
  // Toda troca de tela começa no topo, inclusive ao voltar (o navegador restauraria a posição de
  // antes) e antes do primeiro desenho (sem piscar). A conversa nova que ganha a sessão troca só o
  // id no endereço: é a mesma tela, não rola. A conversa, depois, desce sozinha até o fim.
  const screenKey = route.name === 'folder' ? `folder:${route.path}` : route.name === 'chat' ? `chat:${route.cwd}` : route.name;
  // A conversa cuida da dela: abre já no fim (com o histórico guardado, no primeiro desenho; e o
  // efeito daqui, do pai, rodaria depois e a jogaria para cima).
  useLayoutEffect(() => {
    if (!screenKey.startsWith('chat:')) window.scrollTo(0, 0);
  }, [screenKey]);
  return (
    <HostProvider conn={conn}>
      <ApplyPreferences />
      {/* Cada tela entra com um fade curto (só opacidade: transform tiraria as barras fixas do lugar).
          A barra de abas fica fora, parada entre as abas. */}
      <div key={pushStep === 'hide' ? screenKey : pushStep} className="screen-fade h-full">
      {/* Primeira entrada: o pedido das notificações antes do app (conferindo, só o fundo). */}
      {pushStep === 'show' ? (
        <NotificationsStep onDone={pushStepDone} />
      ) : pushStep === 'check' ? null : route.name === 'folder' ? (
        <FolderScreen path={route.path} />
      ) : route.name === 'chat' ? (
        <ChatScreen key={route.cwd} cwd={route.cwd} id={route.id} />
      ) : route.name === 'projects' ? (
        <ProjectsScreen />
      ) : route.name === 'settings' ? (
        <SettingsScreen />
      ) : route.name === 'usage' ? (
        <UsageScreen />
      ) : route.name === 'addFolder' ? (
        <AddFolderScreen board={route.board} />
      ) : (
        <HomeScreen />
      )}
      </div>
      {pushStep === 'hide' && isTab(route) && <TabBar current={route.name} />}
      <ConnectionOverlay />
    </HostProvider>
  );
}

// Tampa a faixa do relógio do iPhone com a cor do fundo: o conteúdo que rola não passa borrado por
// trás dela. A barra do topo de cada tela fica por cima (z-20) com a cor dela.
function StatusBarCover() {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-10 h-[env(safe-area-inset-top)] bg-bg" />;
}

export function App() {
  const [host, setHost] = useState<PairedHost | null>(() => loadPairedHost());
  const route = parseRoute(useHash());
  // Clique numa notificação com o app aberto: o service worker manda o endereço.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null;
      if (data?.type === 'open' && typeof data.url === 'string' && data.url.startsWith('#')) location.hash = data.url;
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);
  // No celular, só roda instalado (tela cheia, armazenamento e notificações de app); no computador,
  // também no navegador. No pnpm mobile:dev, roda no navegador para ver as mudanças na hora.
  if (needsInstall() && !import.meta.env.DEV)
    return (
      <>
        <StatusBarCover />
        <InstallScreen code={route.name === 'pair' ? route.code : undefined} />
      </>
    );
  // Um QR code novo pareia de novo (outro computador, ou este depois de remover o aparelho).
  if (!host || route.name === 'pair')
    return (
      <>
        <StatusBarCover />
        <PairScreen initialCode={route.name === 'pair' ? route.code : undefined} onPaired={() => setHost(loadPairedHost())} />
      </>
    );
  return (
    <>
      <StatusBarCover />
      <Connected key={host.deviceId} host={host} />
    </>
  );
}
