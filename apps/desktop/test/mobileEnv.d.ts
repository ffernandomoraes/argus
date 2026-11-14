// O app do celular (apps/mobile) testado daqui (ver src/main/remote/phoneConnection.test.ts): o que o
// Vite declara lá e a checagem de tipos deste projeto não conhece.
declare const __APP_VERSION__: string;
interface ImportMeta {
  readonly env: Record<string, string | boolean | undefined>
}
