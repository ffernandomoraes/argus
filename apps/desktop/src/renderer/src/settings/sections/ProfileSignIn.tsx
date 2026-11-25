import { ACCOUNT_PROVIDERS, type AccountError, type AccountState } from '@argus/shared/account';
import { continueWith, ProviderMark, providerName } from '../../account/ProviderMark';
import { tr } from '../../i18n';
import { Button } from '../../ui/Button';
import { Group } from '../controls';

// Sem conta: entrar com o GitHub ou o Google. O login abre no navegador e volta sozinho para cá.

const ERRORS: Record<AccountError, () => string> = {
  denied: () => tr('Login cancelado no navegador.', 'Sign-in was canceled in the browser.'),
  failed: () => tr('Não deu para entrar. Tente de novo.', "Couldn't sign you in. Try again."),
  expired: () => tr('O login demorou demais. Clique para entrar de novo.', 'Sign-in took too long. Click to sign in again.'),
  offline: () => tr('Sem conexão com o servidor do Argus. Confira a internet e tente de novo.', "Can't reach the Argus server. Check your connection and try again."),
  revoked: () =>
    tr(
      'Este computador saiu da conta: ele foi removido em outro aparelho ou a conta foi apagada.',
      'This computer was signed out: it was removed from another device or the account was deleted.',
    ),
};

export function ProfileSignIn({ state }: { state: Exclude<AccountState, { status: 'signedIn' }> }) {
  const waiting = state.status === 'signingIn' ? state.provider : null;
  const error = state.status === 'signedOut' ? state.error : null;
  return (
    <Group>
      <div className="flex flex-col gap-3 py-4">
        <p className="text-[15px] leading-relaxed text-muted">
          {tr(
            'Leva tema, idioma, notificações, padrões da conversa e prazos do armazenamento para os seus outros computadores. O zoom fica em cada um.',
            'Takes theme, language, notifications, chat defaults and storage limits to your other computers. Zoom stays on each one.',
          )}
        </p>
        <div className="flex flex-col gap-2">
          {ACCOUNT_PROVIDERS.map((provider) => (
            <Button
              key={provider}
              size="xl"
              disabled={waiting !== null}
              onClick={() => window.api.account.signIn(provider)}
              className="w-full"
            >
              <ProviderMark provider={provider} />
              {continueWith(provider)}
            </Button>
          ))}
        </div>
        {waiting && (
          <div className="flex items-center justify-between gap-3 text-[15px] text-muted">
            <span>{tr(`Continue no navegador para entrar com o ${providerName(waiting)}.`, `Continue in your browser to sign in with ${providerName(waiting)}.`)}</span>
            <Button variant="ghost" onClick={() => window.api.account.cancelSignIn()}>
              {tr('Cancelar', 'Cancel')}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[15px] leading-relaxed text-red-400">
            {ERRORS[error]()}
          </p>
        )}
      </div>
    </Group>
  );
}
