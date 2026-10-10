// App do projeto que está na tela: num monorepo, o `dev` sobe vários (site, admin, app), um por
// porta. `dir` é a pasta dele dentro do projeto ('' na raiz ou quando não se sabe).
export type ProjectApp = { port: number; dir: string; name?: string; page?: boolean }

// Os apps que mostram página, para escolher qual abrir; a API e afins ficam de fora. Sem nenhum
// confirmado (ainda conferindo, ou o "/" de todos dá erro), todos.
export const pageApps = (apps: ProjectApp[]): ProjectApp[] => {
  const pages = apps.filter((a) => a.page)
  return pages.length ? pages : apps
}

const appName = (app: ProjectApp): string => app.name ?? app.dir.split('/').filter(Boolean).pop() ?? ''

export const appLabel = (app: ProjectApp): string => (appName(app) ? `${appName(app)} - ${app.port}` : `localhost:${app.port}`)
