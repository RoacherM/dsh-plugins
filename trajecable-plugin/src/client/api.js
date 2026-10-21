// Browser calls to the plugin's Host routes. Same origin, same cookies, JSON only.
const url = (path, query = {}) => {
  const target = new URL(`api/trajecable${path}`, document.baseURI);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, value);
  }
  return target;
};

async function call(method, path, { query, signal, body } = {}) {
  const response = await fetch(url(path, query), {
    method,
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const api = {
  timeline: (params, signal) => call('GET', '/timeline', { query: params, signal }),
  session: (key, tz, signal) => call('GET', '/session', { query: { key, tz }, signal }),
  status: (signal) => call('GET', '/status', { signal }),
  scan: () => call('POST', '/scan'),
  summary: (key, tz, force = false) => call('POST', '/summary', { body: { key, tz, force } }),
};
