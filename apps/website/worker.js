// Worker of the site: serves the static files (dist/) and, under /api/github/*, a cached copy of the
// GitHub data the pages show (stars, latest release, release notes). Calling api.github.com straight
// from the browser hit the 60 requests/hour limit for shared IPs (PageSpeed servers included) and
// logged 403 errors. Here GitHub is asked at most once every 10 minutes per data center; when it
// fails, the last good copy (kept for a week) is served, and with none the answer is `null`.
const REPO = 'https://api.github.com/repos/ffernandomoraes/argus';
const FRESH_SECONDS = 600;
const STALE_SECONDS = 7 * 24 * 3600;

const pickAsset = (a) => ({ name: a.name, size: a.size, browser_download_url: a.browser_download_url });
const pickRelease = (r) => ({ tag_name: r.tag_name, html_url: r.html_url, published_at: r.published_at, body: r.body });

const ROUTES = {
  repo: { url: REPO, pick: (repo) => ({ stargazers_count: repo.stargazers_count }) },
  latest: { url: `${REPO}/releases/latest`, pick: (r) => ({ tag_name: r.tag_name, assets: r.assets.map(pickAsset) }) },
  releases: { url: `${REPO}/releases?per_page=20`, pick: (list) => list.map(pickRelease) },
};

const json = (body, maxAge) =>
  new Response(body, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
  });

async function fromGitHub(route, env) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'argus-website' };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(route.url, { headers });
    return res.ok ? JSON.stringify(route.pick(await res.json())) : null;
  } catch {
    return null;
  }
}

async function github(name, request, env, ctx) {
  const route = ROUTES[name];
  if (!route) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const freshKey = new Request(`${origin}/api/github/${name}?fresh`);
  const staleKey = new Request(`${origin}/api/github/${name}?stale`);

  const fresh = await cache.match(freshKey);
  if (fresh) return fresh;

  const body = await fromGitHub(route, env);
  if (body) {
    ctx.waitUntil(Promise.all([cache.put(freshKey, json(body, FRESH_SECONDS)), cache.put(staleKey, json(body, STALE_SECONDS))]));
    return json(body, FRESH_SECONDS);
  }
  const stale = await cache.match(staleKey);
  return stale ? json(await stale.text(), 60) : json('null', 60);
}

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const match = pathname.match(/^\/api\/github\/(\w+)$/);
    return match ? github(match[1], request, env, ctx) : env.ASSETS.fetch(request);
  },
};
