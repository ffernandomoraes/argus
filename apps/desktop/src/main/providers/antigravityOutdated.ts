import { MIN_VERSIONS } from '@argus/shared/providers';
import { tr } from '../i18n';

// Antigravity CLI antigo demais para o Argus: a versão aceita e o aviso da tela. Sem dependências
// pesadas: a conversa (agentChats/acp.ts) também usa.

// `agy acp` nasceu na 1.5.0 (changelog do agy). Antes dela, o `acp` é recusado e o login falha.
export const AGY_MIN_VERSION = MIN_VERSIONS.antigravity!;

// O que a tela diz quando o agy é antigo demais: a versão aceita e como atualizar.
export const outdatedMessage = (version?: string): string =>
  tr(
    `O Argus funciona com o Antigravity CLI ${AGY_MIN_VERSION} ou mais novo${version ? `, e o deste computador é o ${version}` : ''}. Atualize em Configurações > Contas > Antigravity (botão Atualizar) ou rode "agy update" no terminal, e tente de novo.`,
    `Argus works with Antigravity CLI ${AGY_MIN_VERSION} or newer${version ? `, and this computer has ${version}` : ''}. Update it in Settings > Accounts > Antigravity (Update button) or run "agy update" in a terminal, then try again.`,
  );

// O agy recusou o `acp`: é versão sem ele.
export const missingAcp = (text: string): boolean => /unexpected argument "?acp|unknown (sub)?command "?acp|flag provided but not defined/i.test(text);

