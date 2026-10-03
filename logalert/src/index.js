// 前端错误归档端点：收 blovy.art 的上报，按天落到 R2，附带一个简单查询页。

const CONFIG = {
  TZ: 'Asia/Shanghai',
  PREFIX: 'logs/',
  MAX_BODY: 8 * 1024,
  MAX_MSG: 2000,
  MAX_STACK: 4000,
  DEDUP_MS: 60_000,
  PUBLIC_PER_MIN: 20,
  LIST_MAX: 100,
  EXPORT_MAX: 1000,
  MAX_SPAN: 31,
}

const LEVELS = new Set(['debug', 'info', 'error', 'severe', 'alert', 'stack', 'slow'])

const dedup = new Map()
const publicHits = new Map()

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TZ })
const clockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CONFIG.TZ,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  })
}

function cors() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-alert-key',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  })
}

// 同一处报错只要带上不同的 id / 时间 / 数字就是另一条指纹，去重会失效
function normalize(text) {
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '{uuid}')
    .replace(/\b[0-9a-f]{8,}\b/gi, '{hex}')
    .replace(/\d+/g, '#')
    .trim()
    .slice(0, 200)
}

async function fingerprint(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(normalize(text)))
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

function safeService(v) {
  const s = String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
  return s.slice(0, 32) || 'unknown'
}

function allowPublic(ip) {
  const now = Date.now()
  const hits = (publicHits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= CONFIG.PUBLIC_PER_MIN) {
    publicHits.set(ip, hits)
    return false
  }
  hits.push(now)
  publicHits.set(ip, hits)
  if (publicHits.size > 2000) publicHits.clear()
  return true
}

async function ingest(req, env) {
  const raw = await req.text()
  if (raw.length > CONFIG.MAX_BODY) return json({ error: 'payload too large' }, 413)

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const key = req.headers.get('x-alert-key') ?? ''
  const trusted = Boolean(env.ALERT_KEY) && key === env.ALERT_KEY
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!trusted && !allowPublic(ip)) return json({ error: 'rate limited' }, 429)

  const msg = String(body.msg ?? '').slice(0, CONFIG.MAX_MSG)
  if (!msg) return json({ error: 'msg required' }, 400)
  const stack = String(body.stack ?? '').slice(0, CONFIG.MAX_STACK)
  const level = LEVELS.has(body.level) ? body.level : 'error'
  // 没有 key 的来源能伪造 service，归档路径就成了任意目录，所以公开来源一律落到 web/
  const service = trusted ? safeService(body.service) : 'web'
  const fp =
    trusted && /^[0-9a-f]{6,16}$/.test(body.fp ?? '') ? body.fp : await fingerprint(msg)

  const now = Date.now()
  if (now - (dedup.get(fp) ?? 0) < CONFIG.DEDUP_MS) return json({ ok: true, dedup: true, fp })
  dedup.set(fp, now)
  if (dedup.size > 5000) dedup.clear()

  const at = new Date(now)
  const objectKey = `${CONFIG.PREFIX}${dayFmt.format(at)}/${service}/${clockFmt.format(at)}-${fp}.json`
  const record = {
    service,
    level,
    fp,
    build: String(body.build ?? '').slice(0, 64),
    msg,
    stack,
    at: at.toISOString(),
    url: String(body.url ?? '').slice(0, 500),
    ua: String(body.ua ?? '').slice(0, 300),
  }
  if (!trusted) record.ip = ip

  await env.BUCKET.put(objectKey, JSON.stringify(record))
  return json({ ok: true, fp, key: objectKey })
}

const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

// 只在日历标签上加减天数，所以按 UTC 算 —— 换成上海时区会把 UTC 零点挪到前一天
function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

async function collect(env, days, cap) {
  const items = []
  let truncated = false
  for (const day of days) {
    const room = cap - items.length
    if (room <= 0) {
      truncated = true
      break
    }
    const listed = await env.BUCKET.list({
      prefix: `${CONFIG.PREFIX}${day}/`,
      limit: Math.min(room, 1000),
    })
    if (listed.truncated) truncated = true
    const keys = listed.objects.map((o) => o.key).sort().reverse()
    for (const k of keys) {
      const obj = await env.BUCKET.get(k)
      if (obj) items.push(await obj.json())
    }
  }
  items.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
  return { from: days[0], to: days[days.length - 1], count: items.length, truncated, items }
}

async function list(env, url) {
  const key = url.searchParams.get('key') ?? ''
  if (!env.ALERT_KEY || key !== env.ALERT_KEY) return json({ error: 'unauthorized' }, 401)

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const date = url.searchParams.get('date') ?? (from || to ? null : dayFmt.format(new Date()))

  if (date) {
    if (!isDay(date)) return json({ error: 'bad date' }, 400)
    return json(await collect(env, [date], CONFIG.LIST_MAX))
  }

  if (!isDay(from) || !isDay(to)) return json({ error: 'bad date' }, 400)
  if (from > to) return json({ error: 'from after to' }, 400)
  const days = []
  // 字符串比较对 ISO 日期有效；MAX_SPAN 同时也是循环上界
  for (let d = from; d <= to && days.length <= CONFIG.MAX_SPAN; d = shiftDay(d, 1)) days.push(d)
  if (days.length > CONFIG.MAX_SPAN) return json({ error: 'range too long' }, 400)
  return json(await collect(env, days, CONFIG.EXPORT_MAX))
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return cors()
    if (url.pathname === '/ingest') {
      return req.method === 'POST' ? ingest(req, env) : json({ error: 'method not allowed' }, 405)
    }
    if (url.pathname === '/list') {
      if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405)
      const res = await list(env, url)
      if (url.searchParams.get('download') !== '1') return res
      const body = await res.text()
      const span = `${url.searchParams.get('from') ?? ''}_${url.searchParams.get('to') ?? ''}`
      return new Response(body, {
        status: res.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="logs-${span}.json"`,
        },
      })
    }
    if (url.pathname === '/' && req.method === 'GET') {
      // 页面本身改得比访客刷新频繁，没有 cache-control 时浏览器会按启发式缓存留着旧版
      return new Response(PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    return json({ error: 'not found' }, 404)
  },
}

const PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>logs</title>
<style>
  body { margin: 0; padding: 16px; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #1c1c1c; background: #f6f6f4; }
  #bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  input, button, select { font: inherit; padding: 4px 8px; border: 1px solid #b9b9b4; background: #fff; color: inherit; }
  button { cursor: pointer; }
  #meta { color: #767670; }
  .row { border: 1px solid #dededa; background: #fff; padding: 8px 10px; margin-bottom: 6px; }
  .row + .row { margin-top: -1px; }
  .head { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
  .t { color: #767670; }
  .svc { font-weight: 700; }
  .lv { padding: 0 6px; border: 1px solid #b9b9b4; color: #767670; }
  .lv.error, .lv.severe, .lv.alert { border-color: #c0392b; color: #c0392b; }
  .fp { color: #767670; margin-left: auto; }
  .b { color: #767670; }
  .msg { margin-top: 6px; white-space: pre-wrap; word-break: break-all; }
  .stack { margin-top: 6px; white-space: pre-wrap; color: #767670; display: none; }
  .row.open .stack { display: block; }
  .msg.clickable { cursor: pointer; }
</style>
</head>
<body>
<div id="bar">
  <select id="range">
    <option value="0">今天</option>
    <option value="2">近 3 天</option>
    <option value="6">近 7 天</option>
    <option value="29" selected>近 30 天</option>
    <option value="pick">指定范围</option>
  </select>
  <span id="pick" hidden><input id="from" type="date"> <span>→</span> <input id="to" type="date"></span>
  <input id="key" type="password" placeholder="key" autocomplete="off">
  <button id="go" type="button">查询</button>
  <button id="export" type="button">导出 JSON</button>
  <span id="meta"></span>
</div>
<div id="list"></div>
<script>
  var KEY_STORE = 'logalert.key';
  var $ = function (id) { return document.getElementById(id); };
  // 下拉的默认项写在 HTML 的 selected 上，这里读回来，省得同一件事存两份
  var DEFAULT_RANGE = $('range').value;

  function today() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function render(data, label) {
    var host = $('list');
    host.textContent = '';
    if (!data.items.length) {
      $('meta').textContent = label + ' 没有记录';
      return;
    }
    $('meta').textContent = label + ' · ' + data.count + ' 条' + (data.truncated ? '（已截断）' : '');
    data.items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'row';

      var head = document.createElement('div');
      head.className = 'head';
      [['span', 't', (it.at || '').slice(11, 19)],
       ['span', 'svc', it.service],
       ['span', 'lv ' + (it.level || ''), it.level],
       ['span', 'b', String(it.build || '').slice(5, 16).replace('T', ' ')],
       ['span', 'fp', it.fp]
      ].forEach(function (spec) {
        var el = document.createElement(spec[0]);
        el.className = spec[1];
        el.textContent = spec[2] || '';
        head.appendChild(el);
      });
      row.appendChild(head);

      var msg = document.createElement('div');
      msg.className = 'msg';
      msg.textContent = it.msg || '';
      if (it.stack) {
        msg.className += ' clickable';
        msg.addEventListener('click', function () { row.classList.toggle('open'); });
      }
      row.appendChild(msg);

      if (it.stack) {
        var stack = document.createElement('div');
        stack.className = 'stack';
        stack.textContent = it.stack;
        row.appendChild(stack);
      }
      host.appendChild(row);
    });
  }

  // 日期加减按 UTC 算 —— 用上海时区格式化 UTC 零点会退到前一天
  function shift(base, delta) {
    var d = new Date(base + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  // 查询和导出共用这一份范围，导出的就是当前查的那段
  function query() {
    var v = $('range').value;
    var from, to;
    if (v === 'pick') {
      from = $('from').value || today();
      to = $('to').value || today();
    } else {
      to = today();
      from = shift(to, -parseInt(v, 10));
    }
    if (from > to) { var t = from; from = to; to = t; }
    return { qs: 'from=' + from + '&to=' + to, label: from === to ? to : from + ' ~ ' + to };
  }

  function withKey(qs) {
    var key = $('key').value.trim();
    localStorage.setItem(KEY_STORE, key);
    return qs + '&key=' + encodeURIComponent(key);
  }

  async function load() {
    var q = query();
    $('meta').textContent = '载入中';
    try {
      var r = await fetch('/list?' + withKey(q.qs));
      var data = await r.json();
      if (!r.ok) { $('meta').textContent = data.error || ('HTTP ' + r.status); return; }
      render(data, q.label);
    } catch (e) {
      $('meta').textContent = String(e);
    }
  }

  // 同一个查询加 download=1，服务端给 content-disposition，浏览器直接存文件
  function exportJson() {
    location.href = '/list?' + withKey(query().qs) + '&download=1';
  }

  function syncRange() {
    var picking = $('range').value === 'pick';
    $('pick').hidden = !picking;
    if (picking && !$('from').value) {
      $('to').value = today();
      $('from').value = shift($('to').value, -parseInt(DEFAULT_RANGE, 10));
    }
  }

  $('key').value = localStorage.getItem(KEY_STORE) || '';
  syncRange();
  $('range').addEventListener('change', function () { syncRange(); load(); });
  $('from').addEventListener('change', load);
  $('to').addEventListener('change', load);
  $('go').addEventListener('click', load);
  $('export').addEventListener('click', exportJson);
  $('key').addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });
  if ($('key').value) load();
</script>
</body>
</html>
`
