# logalert

blovy.art 的前端错误归档。访客浏览器里脚本崩了 / 资源加载失败，往这儿扔一条，按天落到 R2，
附带一个查询页能翻。

```
访客浏览器 --POST /ingest--> Worker --> R2 logs/<date>/web/…
你自己 --浏览器--> Worker 查询页 --/list?key=--> R2
```

**只归档，不推送。** Workers 连不上 SMTP 端口（CF 屏蔽 25/465/587），Worker 自己发不出邮件；
CF 自带的 Email Sending 又要 Workers Paid。前端错误也不需要实时喊人 —— 访客刷新一下就好了，
它的价值在「这个错今天出了几次、哪一版带出来的」，那个信息得翻查询页才有。

## 部署

```bash
npx wrangler deploy -c logalert/wrangler.toml
npx wrangler secret put ALERT_KEY -c logalert/wrangler.toml
```

`ALERT_KEY` 只有查询页用（页面上输一次，之后存 localStorage）。⚠️ Cloudflare 后台看不到明文，
忘了只能重新设一个。

部署完默认的 `https://blovy-logalert.<xxx>.workers.dev` **不能用**：workers.dev 在国内经常
TCP 直接超时（浏览器能开多半是走了代理或 DoH），访客上报会全部失败。
所以 `wrangler.toml` 里已经挂了 `log.blovy.art`（域名在 CF，deploy 时会自动建 DNS 记录），
上报端点用 `https://log.blovy.art/ingest`。

R2 用独立的 `blovy-logs` 桶，**不要换成站点的 `blovy-art`** —— 那个桶绑了公开域名
`cdn.blovy.art`，全桶可读，日志放进去等于把访客 IP / UA / URL 摆成公网直链
（`https://cdn.blovy.art/logs/…` 直接 200，查询页那把 key 挡不住它）。
`blovy-logs` 不挂任何公开域名，Worker 通过 binding 读写，公网根本没有 URL。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/ingest` | 上报一条。带 `x-alert-key` 且匹配 = 可信来源（service 由调用方定）；不带 = 公开来源，强制落到 `web/`、按 IP 限流 20 条/分钟 |
| GET | `/list?date=YYYY-MM-DD&key=` | 取某天的条目，最多 100 条 |
| GET | `/list?from=&to=&key=` | 取日期区间，最多 1000 条、跨度 ≤ 31 天。加 `&download=1` 带 `content-disposition`，浏览器直接存文件 |
| GET | `/` | 查询页。范围下拉（今天 / 近 3 天 / 近 7 天 / 近 30 天 / 指定范围）同时决定**查询和导出**的范围 —— 导出的就是当前查的那段。默认近 30 天，选「指定范围」出两个日期框 |
| GET | `/map?file=&key=` | 取 sourcemap，解码堆栈用。文件名白名单 `[A-Za-z0-9._-]+\.js\.map` |

同指纹 60 秒内只归档一条 —— 循环报错一秒几百条，全存会把 R2 的写操作额度烧掉。

## 前端上报（已接入）

`src/utils/alert.js` 挂了三类捕获：`window.onerror`（脚本错误）、捕获阶段的 `error`
（图片/字体/脚本加载失败，`onerror` 抓不到，得单独监听）、`unhandledrejection`。

上报字段：`msg` / `stack` / `url` / `ua` / `build`。

- **跨域脚本的报错一律丢掉**：拿不到堆栈，只剩一句 `Script error.`，`filename` 也空，存进来是噪音
- 同一个错在一个会话里只发一次（`sessionStorage`），循环报错会把公开限流打满
- 上报失败静默 —— 跑在访客浏览器里的东西不能让页面出任何动静

端点用 `VITE_ALERT_URL` 配（见仓库根 `.env.production`）。**没配就是没这个功能**：
dev 下不配，本地开发时的报错不会混进归档，访客也不会多下载一个字节。

`build` 是 `vite.config.js` 里 `define` 注入的构建时刻时间戳，用来分辨「这个错是哪一版带出来的」。

## 堆栈解码

线上产物是压缩的，`stack` 里只有 `index-XXX.js:30:51832` 这种坐标，得靠 sourcemap 翻回源码位置。

- `vite.config.js` 里 `sourcemap: 'hidden'`（产出 `.map` 但不写 `sourceMappingURL`，否则 DevTools 会去请求一个不存在的公开地址）+ `sourcemapExcludeSources: true`（不内嵌源码正文，1.1 MB → 300 kB，也顺带解决源码泄露）。
- CI 在 build 之后把 `.map` 传到 `blovy-logs/maps/<文件名>`，然后从 `dist` 里删掉；归档那步 `continue-on-error`，缺密钥也不会阻断发布。
- 查询页点开某条堆栈时才去取图（按文件缓存），解码器写在页面里，零依赖。

⚠️ **map 只在构建那一刻才有**：某次构建没产出，那批日志就永远解不回源码。

CI 归档需要在仓库 Settings → Secrets 里配 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`；没配的话 map 不会进桶，解码会提示取不到图。

## 已知代价

- 去重是**单实例内存**的：Worker 可能被调度到多个边缘节点，理论上同指纹会各落一条。量小无所谓。
- R2 只写不清理。要清就按前缀删 `logs/<date>/`。
- `/list` 没限流，key 够长就没事。
