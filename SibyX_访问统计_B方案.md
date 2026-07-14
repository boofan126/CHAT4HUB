# SibyX 访问统计 · B 档实现方案（cookieless 匿名聚合）

> 状态：规划稿，未实施。仅放开发副本 `D:/chat4`，**未同步进 CHAT4HUB、未 git 提交**。
> 用户已拍板选 B（匿名聚合 + 引流来源洞察），待审阅后授权实现。

---

## 0. 目标与边界

**要什么**
- 一个受 token 保护的 `/admin` 看板，能看到：总访问、今日/昨日/7 日/30 日、独立访客（去重）、Top 来源域名、Top 渠道(campaign)、粗粒度国家分布。
- 前端一行 beacon 把访问打给中继，能看到"从哪个渠道来"——支撑引流决策。

**边界（必须遵守，否则砸隐私卖点）**
- ❌ 不写 cookie、不用 localStorage、不做指纹识别。
- ❌ 不存明文 IP、不全 UA、不存完整 referrer URL（只存来源域名）。
- ✅ IP 做 **HMAC-SHA256 + 按日加盐 + 截断 16 位** → 不可逆、且跨日不可关联。
- ✅ 数据仅用于**聚合**，不做个体追踪。
- ✅ 必须在隐私声明里如实写"我们做 cookieless 匿名统计"。

**隐私定位对齐**：B 档 = Plausible / Umami 同哲学（cookieless、聚合、去标识）。不碰 C 档（明文 IP 日志）。

---

## 1. 架构

```
浏览器(index.html beacon)  ──POST /track──▶  chat4hub-relay (Node, Render Web Service)
                                              │  - 取 x-forwarded-for
                                              │  - HMAC 哈希 + 按日加盐 + 截断
                                              │  - 写 Upstash Redis
                                              ▼
                                        Upstash Redis (免费, 持久, serverless)
                                              ▲
                                   GET /admin (token 保护) 读聚合
                                              │
                                        你 (浏览器)
```

- `/track` 与 `/admin` 加在**现有中继服务**上（Render Web Service `chat4hub-relay`，Root Directory = `relay/`）。不新增服务。
- 持久化用 **Upstash Redis**，因为 Render 免费层文件系统是临时的（重启/部署即丢），不能写本地 JSON。

---

## 2. 改动文件清单（实现时执行）

| 文件 | 改动 | 双文件夹同步 |
|---|---|---|
| `relay/relay.js` | 新增 `POST /track`、`GET /admin`、CORS、OPTIONS 预检；引入 analytics 模块 | ✅ chat4 + CHAT4HUB 两处一致 |
| `relay/analytics.js` | **新增**：IP 哈希、Redis 写入、聚合查询函数 | ✅ 两处一致 |
| `relay/package.json` | 加依赖 `@upstash/redis` | ✅ 两处一致 |
| `relay/.env.example` | 文档化环境变量（不提交真实值） | ✅ 两处一致 |
| `index.html` | 末尾注入 beacon `<script>`（用 `window.__RELAY__` 指向可配置中继） | ✅ 两处一致 |
| `使用说明.md` / `USAGE.MD` / `README.md` | 新增"匿名访问统计"小节（隐私声明） | ✅ 两处一致 |

> 双文件夹约定：实现时改完 `D:/chat4` 副本后 `cp` 到 `D:/CHAT4HUB`，再 git commit/push（触发 Render 中继重部署）。

---

## 3. 各模块实现要点

### 3.1 前端 beacon（`index.html` 末尾，`</body>` 前）

```html
<script>
(function(){
  try{
    var relay = (window.__RELAY__ || 'https://chat4hub-relay.onrender.com').replace(/\/$/,'');
    var p = new URLSearchParams(location.search);
    var camp = p.get('ref') || p.get('utm_source') || 'direct';
    var ref = 'direct';
    try { if (location.referrer) ref = new URL(location.referrer).host; } catch(e){}
    var body = JSON.stringify({ path: location.pathname, ref: ref, camp: camp,
                               dnt: (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes') });
    if (navigator.sendBeacon) navigator.sendBeacon(relay + '/track', new Blob([body], {type:'application/json'}));
    else fetch(relay + '/track', {method:'POST', body: body, mode:'no-cors'});
  }catch(e){}
})();
</script>
```

要点：
- **非阻塞、失败静默**（try/catch 包裹，统计挂了也不影响主应用）。
- 引流标记用法：`https://你的域名/?ref=reddit` 或 `?utm_source=twitter` → 看板按 `camp` 聚合。
- 尊重 `Do-Not-Track`：若用户浏览器开了 DNT，beacon 仍可发，但 relay 端可选择性不计入（可选，默认计入匿名聚合；DNT 处理作为加分项）。

### 3.2 `/track` 端点（`relay/relay.js` 新增）

```js
const analytics = require('./analytics');

app.post('/track', (req, res) => {
  // CORS（beacon 跨域到 relay）
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  const day = new Date().toISOString().slice(0, 10);
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '0.0.0.0').split(',')[0].trim();
  const { path = '/', ref = 'direct', camp = 'direct' } = req.body || {};
  analytics.record({ ip, day, path: String(path).slice(0, 120),
                     ref: String(ref).slice(0, 80), camp: String(camp).slice(0, 40) });
  res.sendStatus(204);
});
```

> Render 在 Cloudflare 后，真实 IP 在 `x-forwarded-for` 首段；`cf-ipcountry` 头可拿国家码（见 3.4）。

### 3.3 `relay/analytics.js`（核心）

```js
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

// 按日加盐 HMAC + 截断 → 不可逆、跨日不可关联
function ipHash(ip, day){
  const mac = crypto.createHmac('sha256', process.env.IP_SALT || 'change-me');
  mac.update(ip + '|' + day);
  return mac.digest('hex').slice(0, 16); // 64-bit 截断
}

async function record({ ip, day, path, ref, camp }){
  const h = ipHash(ip, day);
  await redis.incr('visits:total');
  await redis.incr('visits:' + day);
  await redis.pfadd('uv:' + day, h);          // HyperLogLog 独立访客
  if (ref && ref !== 'direct') await redis.incr('src:' + ref);
  if (camp && camp !== 'direct') await redis.incr('camp:' + camp);
}

// 聚合查询（供 /admin）
async function summary(){
  const day = new Date().toISOString().slice(0, 10);
  const days7 = lastNDays(7), days30 = lastNDays(30);
  const [total, today, uvToday, topSrc, topCamp] = await Promise.all([
    redis.get('visits:total'),
    redis.get('visits:' + day),
    redis.pfcount('uv:' + day),
    redis.zrange('src:rank', 0, 9, 'REV'),   // 见下：用 sorted set 存来源排行
    redis.zrange('camp:rank', 0, 9, 'REV'),
  ]);
  // 7/30 日访问 = 逐日 visits:day 求和（轻量循环）
  // 7 日独立 = PFMERGE 临时键后 PFCOUNT
  return { total, today, uvToday, topSrc, topCamp, /* + 7/30 聚合 */ };
}
```

> **来源/渠道排行**用 Redis Sorted Set（`ZINCRBY src:rank 1 <domain>`）比 `src:<domain>` 字符串计数更易取 Top10；上面伪代码混用，实现时统一为 ZSET。

### 3.4 国家分布（`cf-ipcountry`）

Render（Cloudflare 前）请求带 `cf-ipcountry` 头（ISO 3166-1 alpha-2，如 `CN`/`US`/`XX`）。在 `/track` 取 `req.headers['cf-ipcountry']`，`ZINCRBY cc:rank 1 <CC>`。看板显示 Top 国家（**粗粒度，仅国家码，不存城市**）。

### 3.5 `/admin` 看板（token 保护）

```js
app.get('/admin', async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const auth = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
  const token = auth ? auth[1] : url.searchParams.get('token') || '';
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).send('Unauthorized');
  const data = await analytics.summary();
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboard(data)); // 纯 HTML/CSS 柱状图，不引外部 CDN（CDN 不稳）
});
```

- 认证：优先 `Authorization: Bearer <ADMIN_TOKEN>`；也支持 `?token=`（便于你直接浏览器打开）。
- `ADMIN_TOKEN` 用强随机串（如 `openssl rand -hex 24`），存 Render 环境变量，**绝不硬编码 / 不提交**。
- 看板自包含：内联 CSS 画柱状图，无 Chart.js 等外部依赖（避免 CDN 不可达）。

---

## 4. 环境变量与 secrets（仅存 Render，不进仓库）

| 变量 | 说明 | 来源 |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL | Upstash 控制台 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST Token | Upstash 控制台 |
| `IP_SALT` | HMAC 加盐密钥（随机长串） | `openssl rand -hex 32` |
| `ADMIN_TOKEN` | 看板访问令牌（强随机） | `openssl rand -hex 24` |

> `relay/.env.example` 只列变量名与占位，**真实值只在 Render Dashboard 填**。本地测试可在 `relay/.env`（`gitignore` 已忽略或手动不加）。

---

## 5. Render 部署步骤（实现时）

1. Upstash 注册 → 建 Redis 数据库（免费层 10k cmd/天，beta 够用）→ 复制 REST URL/Token。
2. Render Dashboard → `chat4hub-relay` 服务 → Environment → 加 4 个变量。
3. 本地改完 `relay/` 相关文件 → `cp` 到 CHAT4HUB → `git commit && git push` → Render 自动重部署中继。
4. 验证：`curl -XPOST https://chat4hub-relay.onrender.com/track -d '{"path":"/","ref":"reddit","camp":"beta"}'`，再 `curl -H "Authorization: Bearer <TOKEN>" https://chat4hub-relay.onrender.com/admin` 看 JSON/HTML。

---

## 6. 隐私声明文案（写进 docs）

> **匿名访问统计**：SibyX 使用 cookieless 匿名统计了解访问情况。我们不设置 cookie、不使用 localStorage、不做设备指纹。您的 IP 地址会在服务器端经 HMAC-SHA256 加盐哈希并截断处理后存储，无法还原为原始 IP，且每日重新加盐，无法跨日关联。我们仅记录来源域名（不含完整链接）、渠道标记与国家代码级别的聚合数据，不收集任何可识别个人的信息。您可通过浏览器的"禁止追踪"(Do Not Track) 表达偏好。

---

## 7. 成本

- Upstash 免费层：10,000 命令/天（beta 期绰绰有余；每访问约 2–4 条命令）。
- Render：`chat4hub-relay` 已有（免费层 15 分钟休眠）。统计在其上跑，**零额外服务器成本**。
- 域名/其他：不变。

---

## 8. 风险与权衡

| 项 | 说明 | 缓解 |
|---|---|---|
| IP 哈希仍属"个人信息边缘" | 截断 16 位 hex + 按日加盐 → 不可逆、不可跨日关联，实践中视为匿名聚合，降低 PIPL 触发 | 如实隐私声明 |
| `/admin` 成泄露点 | 若 token 泄露，别人也能看数据 | token 强随机 + 仅 Render 环境变量 + Bearer 优先 |
| 中继休眠期统计丢失 | 公共中继 15 分钟休眠，冷启动期间 /track 可能失败 | beacon 失败静默，不影响主应用；唤醒后恢复 |
| 跨日独立访客精度 | 按日 HLL 不可直接得 7 日唯一 → 用 PFMERGE 临时键估算 | 实现时处理，误差 <1% |
| "零采集"叙事弱化 | 仍算"采集"，只是匿名 | 公开声明 + 不碰 C 档，维持可信度 |

---

## 9. 执行前确认清单（待你拍板）

- [ ] 确认用 Upstash Redis（而非 GunDB 持久化，因 Gun 不适合计数器/HLL）。
- [ ] 确认 beacon 注入位置：`index.html` 欢迎页加载即发（覆盖所有访客）✅ 还是仅进应用后发。
- [ ] 确认引流标记规范：`?ref=` 还是 `?utm_source=`（方案两者都认，默认 `ref`）。
- [ ] 确认是否尊重 DNT（默认计入，可选排除）。
- [ ] 确认看板访问方式：Bearer 头（推荐）还是 `?token=` 便捷打开（方案两者都支持）。

---

> 本方案不修改任何已部署文件，待你审阅授权后进入实现。
