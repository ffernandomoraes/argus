// O que o Claude Code responde quando a conta da conversa não consegue se autenticar (textos da
// 2.1.322, medidos com logins falsos): sem login guardado, "Not logged in · Please run /login" (ou
// "Invalid API key · Please run /login"); login que se perdeu (o servidor recusou o login ou a
// renovação, e o Claude Code o apagou), "Failed to authenticate: OAuth session expired and could not
// be refreshed"; login que chegou ao prazo final, "Failed to authenticate: this login reached its
// time limit and cannot be renewed. Run `claude auth login`...". O /login e o `claude auth login`
// dele não existem aqui dentro: a conversa ganha o botão de entrar (ver ErrorRow).
// O processo principal já marca esses pedidos pelo erro que o Claude Code informa, sem depender do
// texto (ChatState.loginNeeded); isto cobre o que chega só como texto.
// O aviso de antes do prazo ("this sign-in can end at any time... Renewing it does not move that
// date") não é erro e não entra.
const NEEDS_LOGIN = /not logged in|please run \/login|failed to authenticate|oauth session expired|reached its time limit|cannot be renewed/i;

export const needsLogin = (error: string): boolean => NEEDS_LOGIN.test(error);
