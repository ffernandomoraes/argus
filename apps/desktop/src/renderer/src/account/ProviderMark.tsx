import type { AccountProvider } from '@argus/shared/account';
import { tr } from '../i18n';

// A marca fica em @argus/ui (o app do celular usa a mesma).
export { ProviderMark } from '@argus/ui/icons/ProviderMark';

export const providerName = (provider: AccountProvider): string => (provider === 'github' ? 'GitHub' : 'Google');

export const continueWith = (provider: AccountProvider): string =>
  provider === 'github' ? tr('Continuar com o GitHub', 'Continue with GitHub') : tr('Continuar com o Google', 'Continue with Google');
