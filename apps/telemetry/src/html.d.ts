// O painel vem como texto (regra Text no wrangler.toml).
declare module '*.html' {
  const html: string;
  export default html;
}
