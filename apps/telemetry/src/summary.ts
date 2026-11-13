// Os números do painel, somados no próprio banco (D1 é SQLite: json_each abre os mapas guardados no
// payload). Período: os últimos N dias, pelo dia local de quem mandou.

type Row = Record<string, unknown>;
type Count = { key: string; value: number };

export type Summary = {
  days: number
  since: string
  generatedAt: string
  totals: {
    installs: number
    newInstalls: number
    activeMinutes: number
    avgMinutesPerDay: number
    chats: number
    messages: number
    turns: number
    tokens: number
    costUsd: number
    appOpens: number
    workspacesCreated: number
    worktreesCreated: number
    installsAllTime: number
  }
  // Os mesmos números no período anterior, do mesmo tamanho (para a variação).
  previous: { installs: number; newInstalls: number; avgMinutesPerDay: number; chats: number; messages: number; tokens: number; costUsd: number }
  daily: { day: string; installs: number; newInstalls: number; minutes: number; chats: number; tokens: Record<string, number> }[]
  chatsByAgent: Count[]
  messagesByAgent: Count[]
  models: { key: string; agent: string; model: string; turns: number; input: number; output: number; cacheRead: number; cacheWrite: number; costUsd: number }[]
  tools: Count[]
  // Pela versão mais recente de cada instalação ativa no período.
  os: Count[]
  osVersions: Count[]
  versions: Count[]
  latestVersion: string | null
  claudeCode: Count[]
  arch: Count[]
  languages: Count[]
  plans: Count[]
  providers: Count[]
  wsl: number
  remoteAccess: number
  snapshot: { installs: number; workspaces: number; folders: number; worktrees: number; groups: number; chatCards: number; terminals: number; notes: number }
  retention: { day: number; eligible: number; returned: number }[]
};

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const counts = (rows: Row[]): Count[] => rows.map((r) => ({ key: String(r.key), value: n(r.value) })).sort((a, b) => b.value - a.value);

// "0.1.120" > "0.1.99": compara número a número.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map(Number);
  const pb = b.split(/[.+-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// A última versão de cada instalação no período (a linha do dia mais recente dela).
const LATEST = `WITH latest AS (
  SELECT r.* FROM reports r
  WHERE r.day >= ?1 AND r.day = (SELECT MAX(day) FROM reports WHERE install_id = r.install_id AND day >= ?1)
)`;

export async function buildSummary(db: D1Database, days: number, today = new Date()): Promise<Summary> {
  const since = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const prevSince = new Date(today.getTime() - (2 * days - 1) * 86_400_000).toISOString().slice(0, 10);
  const q = (sql: string, ...binds: unknown[]) => db.prepare(sql).bind(...binds);
  const mapSum = (path: string) =>
    q(`SELECT j.key AS key, SUM(j.value) AS value FROM reports r, json_each(r.payload, '${path}') j WHERE r.day >= ?1 GROUP BY j.key`, since);
  const latestGroup = (expr: string) => q(`${LATEST} SELECT ${expr} AS key, COUNT(*) AS value FROM latest GROUP BY key`, since);
  const retention = (d: number) =>
    q(
      `WITH f AS (SELECT install_id, MIN(day) AS d0 FROM reports GROUP BY install_id)
       SELECT COUNT(*) AS eligible,
              SUM(EXISTS (SELECT 1 FROM reports r WHERE r.install_id = f.install_id AND r.day >= date(f.d0, '+${d} day'))) AS returned
       FROM f WHERE f.d0 <= date('now', '-${d} day')`,
    );

  const results = await db.batch([
    // 0: por dia
    q('SELECT day, COUNT(*) AS installs, SUM(active_minutes) AS minutes FROM reports WHERE day >= ?1 GROUP BY day ORDER BY day', since),
    // 1: instalações novas por dia (primeiro dia de cada uma)
    q('SELECT d0 AS day, COUNT(*) AS value FROM (SELECT MIN(day) AS d0 FROM reports GROUP BY install_id) WHERE d0 >= ?1 GROUP BY d0', since),
    // 2: totais
    q(
      `SELECT COUNT(DISTINCT install_id) AS installs, SUM(active_minutes) AS minutes,
              AVG(CASE WHEN active_minutes > 0 THEN active_minutes END) AS avgMinutes,
              SUM(json_extract(payload, '$.counts.appOpens')) AS appOpens,
              SUM(json_extract(payload, '$.counts.workspacesCreated')) AS workspacesCreated,
              SUM(json_extract(payload, '$.counts.worktreesCreated')) AS worktreesCreated
       FROM reports WHERE day >= ?1`,
      since,
    ),
    // 3, 4: conversas e mensagens por agente
    mapSum('$.counts.chatsCreated'),
    mapSum('$.counts.messagesSent'),
    // 5: modelos
    q(
      `SELECT j.key AS key, SUM(json_extract(j.value, '$.turns')) AS turns, SUM(json_extract(j.value, '$.input')) AS input,
              SUM(json_extract(j.value, '$.output')) AS output, SUM(json_extract(j.value, '$.cacheRead')) AS cacheRead,
              SUM(json_extract(j.value, '$.cacheWrite')) AS cacheWrite, SUM(json_extract(j.value, '$.costUsd')) AS costUsd
       FROM reports r, json_each(r.payload, '$.models') j WHERE r.day >= ?1 GROUP BY j.key`,
      since,
    ),
    // 6: tokens por dia e modelo
    q(
      `SELECT r.day AS day, j.key AS key,
              SUM(json_extract(j.value, '$.input') + json_extract(j.value, '$.output') + json_extract(j.value, '$.cacheRead') + json_extract(j.value, '$.cacheWrite')) AS value
       FROM reports r, json_each(r.payload, '$.models') j WHERE r.day >= ?1 GROUP BY r.day, j.key`,
      since,
    ),
    // 7: ferramentas
    mapSum('$.tools'),
    // 8-14: pela última versão de cada instalação
    latestGroup('os'),
    latestGroup('os || \' \' || os_version'),
    latestGroup('app_version'),
    latestGroup('COALESCE(json_extract(payload, \'$.app.claudeCode\'), \'desconhecida\')'),
    latestGroup('arch'),
    latestGroup('language'),
    q(
      `${LATEST} SELECT COUNT(*) AS installs,
         SUM(json_extract(payload, '$.snapshot.workspaces')) AS workspaces, SUM(json_extract(payload, '$.snapshot.folders')) AS folders,
         SUM(json_extract(payload, '$.snapshot.worktrees')) AS worktrees, SUM(json_extract(payload, '$.snapshot.groups')) AS groups,
         SUM(json_extract(payload, '$.snapshot.chatCards')) AS chatCards, SUM(json_extract(payload, '$.snapshot.terminals')) AS terminals,
         SUM(json_extract(payload, '$.snapshot.notes')) AS notes,
         SUM(json_extract(payload, '$.app.wsl')) AS wsl, SUM(json_extract(payload, '$.snapshot.remoteAccess')) AS remoteAccess
       FROM latest WHERE json_type(payload, '$.snapshot') = 'object'`,
      since,
    ),
    // 15, 16: planos do Claude e agentes conectados
    q(`${LATEST} SELECT j.key AS key, SUM(j.value) AS value FROM latest, json_each(latest.payload, '$.snapshot.claudePlans') j GROUP BY j.key`, since),
    q(`${LATEST} SELECT j.value AS key, COUNT(*) AS value FROM latest, json_each(latest.payload, '$.snapshot.providers') j GROUP BY j.value`, since),
    // 17: versão mais nova vista
    q('SELECT DISTINCT app_version AS v FROM reports WHERE day >= ?1', since),
    // 18: instalações desde sempre
    q('SELECT COUNT(DISTINCT install_id) AS value FROM reports'),
    // 19-21: retenção
    retention(1),
    retention(7),
    retention(30),
    // 22: conversas por dia
    q('SELECT r.day AS day, SUM(j.value) AS value FROM reports r, json_each(r.payload, \'$.counts.chatsCreated\') j WHERE r.day >= ?1 GROUP BY r.day', since),
    // 23-26: período anterior
    q(
      `SELECT COUNT(DISTINCT install_id) AS installs, AVG(CASE WHEN active_minutes > 0 THEN active_minutes END) AS avgMinutes
       FROM reports WHERE day >= ?1 AND day < ?2`,
      prevSince,
      since,
    ),
    q(
      `SELECT j.key AS key, SUM(j.value) AS value FROM reports r, json_each(r.payload, '$.counts.chatsCreated') j
       WHERE r.day >= ?1 AND r.day < ?2 GROUP BY j.key
       UNION ALL
       SELECT 'messages:' || j.key AS key, SUM(j.value) AS value FROM reports r, json_each(r.payload, '$.counts.messagesSent') j
       WHERE r.day >= ?1 AND r.day < ?2 GROUP BY j.key`,
      prevSince,
      since,
    ),
    q(
      `SELECT SUM(json_extract(j.value, '$.input') + json_extract(j.value, '$.output') + json_extract(j.value, '$.cacheRead') + json_extract(j.value, '$.cacheWrite')) AS tokens,
              SUM(json_extract(j.value, '$.costUsd')) AS costUsd
       FROM reports r, json_each(r.payload, '$.models') j WHERE r.day >= ?1 AND r.day < ?2`,
      prevSince,
      since,
    ),
    q('SELECT COUNT(*) AS value FROM (SELECT MIN(day) AS d0 FROM reports GROUP BY install_id) WHERE d0 >= ?1 AND d0 < ?2', prevSince, since),
  ]);
  const rows = (i: number) => (results[i].results ?? []) as Row[];

  const chatsByDay = new Map(rows(22).map((r) => [String(r.day), n(r.value)]));
  const newByDay = new Map(rows(1).map((r) => [String(r.day), n(r.value)]));
  const tokensByDay = new Map<string, Record<string, number>>();
  for (const r of rows(6)) {
    const day = String(r.day);
    const agent = String(r.key).split(':')[0];
    const m = tokensByDay.get(day) ?? {};
    m[agent] = (m[agent] ?? 0) + n(r.value);
    tokensByDay.set(day, m);
  }
  // Todos os dias do período, mesmo os sem nenhum relatório.
  const perDay = new Map(rows(0).map((r) => [String(r.day), r]));
  const daily: Summary['daily'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = perDay.get(day);
    daily.push({ day, installs: n(r?.installs), newInstalls: newByDay.get(day) ?? 0, minutes: n(r?.minutes), chats: chatsByDay.get(day) ?? 0, tokens: tokensByDay.get(day) ?? {} });
  }

  const models = rows(5)
    .map((r) => {
      const key = String(r.key);
      const [agent, ...rest] = key.split(':');
      return {
        key,
        agent,
        model: rest.join(':'),
        turns: n(r.turns),
        input: n(r.input),
        output: n(r.output),
        cacheRead: n(r.cacheRead),
        cacheWrite: n(r.cacheWrite),
        costUsd: n(r.costUsd),
      };
    })
    .sort((a, b) => b.turns - a.turns);

  const t = rows(2)[0] ?? {};
  const snap = rows(14)[0] ?? {};
  const chatsByAgent = counts(rows(3));
  const messagesByAgent = counts(rows(4));
  const versions = rows(17).map((r) => String(r.v)).filter((v) => v !== 'unknown');

  const prev = rows(23)[0] ?? {};
  const prevCounts = rows(24);
  const prevTokens = rows(25)[0] ?? {};

  return {
    days,
    since,
    previous: {
      installs: n(prev.installs),
      newInstalls: n(rows(26)[0]?.value),
      avgMinutesPerDay: n(prev.avgMinutes),
      chats: prevCounts.filter((r) => !String(r.key).startsWith('messages:')).reduce((a, r) => a + n(r.value), 0),
      messages: prevCounts.filter((r) => String(r.key).startsWith('messages:')).reduce((a, r) => a + n(r.value), 0),
      tokens: n(prevTokens.tokens),
      costUsd: n(prevTokens.costUsd),
    },
    generatedAt: new Date().toISOString(),
    totals: {
      installs: n(t.installs),
      newInstalls: [...newByDay.values()].reduce((a, b) => a + b, 0),
      activeMinutes: n(t.minutes),
      avgMinutesPerDay: n(t.avgMinutes),
      chats: chatsByAgent.reduce((a, c) => a + c.value, 0),
      messages: messagesByAgent.reduce((a, c) => a + c.value, 0),
      turns: models.reduce((a, m) => a + m.turns, 0),
      tokens: models.reduce((a, m) => a + m.input + m.output + m.cacheRead + m.cacheWrite, 0),
      costUsd: models.reduce((a, m) => a + m.costUsd, 0),
      appOpens: n(t.appOpens),
      workspacesCreated: n(t.workspacesCreated),
      worktreesCreated: n(t.worktreesCreated),
      installsAllTime: n(rows(18)[0]?.value),
    },
    daily,
    chatsByAgent,
    messagesByAgent,
    models,
    tools: counts(rows(7)).slice(0, 15),
    os: counts(rows(8)),
    osVersions: counts(rows(9)),
    versions: counts(rows(10)).sort((a, b) => compareVersions(b.key, a.key)),
    latestVersion: versions.sort(compareVersions).at(-1) ?? null,
    claudeCode: counts(rows(11)).slice(0, 8),
    arch: counts(rows(12)),
    languages: counts(rows(13)),
    plans: counts(rows(15)),
    providers: counts(rows(16)),
    wsl: n(snap.wsl),
    remoteAccess: n(snap.remoteAccess),
    snapshot: {
      installs: n(snap.installs),
      workspaces: n(snap.workspaces),
      folders: n(snap.folders),
      worktrees: n(snap.worktrees),
      groups: n(snap.groups),
      chatCards: n(snap.chatCards),
      terminals: n(snap.terminals),
      notes: n(snap.notes),
    },
    retention: [1, 7, 30].map((day, i) => ({ day, eligible: n(rows(19 + i)[0]?.eligible), returned: n(rows(19 + i)[0]?.returned) })),
  };
}
