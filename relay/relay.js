/* =====================================================================
 * SibyX · 自建 GunDB 中继（Relay）
 * ---------------------------------------------------------------------
 * 这是一个极简的 GunDB 中继服务：
 *   - 不存任何用户数据、不存消息明文（仅做 P2P 转发的临时缓存）
 *   - 浏览器端把"记录只在本地的"放本地 IndexedDB，中继只负责转发
 *   - 私聊走 E2EE，中继只能看到密文
 *
 * 部署位置（三选一）：
 *   1) 本机运行 + 内网穿透（ngrok 等）临时对外
 *   2) 免费 Node 托管：Railway / Render / Fly.io（见 Procfile）
 *   3) 你自己的 VPS
 *
 * 启动：node relay.js   （或 npm start）
 * 端口：环境变量 PORT，缺省 8765
 * 持久化：环境变量 GUN_FILE，缺省 ./data（中继自身的图数据缓存）
 * ===================================================================== */

'use strict';

const Gun = require('gun');
const express = require('express');
const analytics = require('./analytics');

const app = express();
app.use(Gun.serve); // Gun 提供的静态/握手中间件

const PORT = process.env.PORT || 8765;
const server = app.listen(PORT, () => {
  console.log('[relay] GunDB relay listening on http://0.0.0.0:' + PORT + '/gun');
});

// 把中继挂在同一个 http server 上
const gun = Gun({
  web: server,
  file: process.env.GUN_FILE || './data', // 中继图数据落盘（重启后仍在）
  radisk: true,
});
// P1 三中继镜像化：与官方其他中继互为同图（web3chat-e6or / relay.chatweb3）
gun.peer('https://web3chat-e6or.onrender.com/gun');
gun.peer('https://relay.chatweb3.online/gun');

// 健康检查（方便托管平台探测）
app.get('/', (req, res) => res.send('Web3 chat GunDB relay is running.'));
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- SibyX 匿名访问统计（B 档：cookieless / IP 哈希截断 / 按日加盐）----
function adminAuthorized(req) {
  const auth = (req.headers['authorization'] || '').toString().match(/^Bearer\s+(.+)$/i);
  const t = auth ? auth[1] : (new URL(req.url, 'http://localhost').searchParams.get('token') || '');
  return !!t && t === process.env.ADMIN_TOKEN;
}

app.post('/track', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  let buf = '';
  req.on('data', c => { buf += c; if (buf.length > 1e4) req.destroy(); });
  req.on('end', () => {
    let b = {};
    try { b = JSON.parse(buf || '{}'); } catch (e) { b = {}; }
    const day = new Date().toISOString().slice(0, 10);
    const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '0.0.0.0').toString().split(',')[0].trim();
    const ref = (b.ref && b.ref !== 'direct') ? String(b.ref).slice(0, 80) : 'direct';
    const camp = (b.camp && b.camp !== 'direct') ? String(b.camp).slice(0, 40) : 'direct';
    const path = (b.path || '/').toString().slice(0, 120);
    const cc = (req.headers['cf-ipcountry'] || '').toString().slice(0, 2).toUpperCase();
    analytics.record({ ip, day, path, ref, camp, cc });
    res.sendStatus(204);
  });
});

app.get('/admin', async (req, res) => {
  if (!process.env.ADMIN_TOKEN) return res.status(503).send('ADMIN_TOKEN not set on server.');
  if (!adminAuthorized(req)) return res.status(401).send('Unauthorized');
  const data = await analytics.summary();
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboard(data));
});

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function barRow(label, count, max) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return '<div class="ar"><span class="al">' + escHtml(label) + '</span><span class="ab"><i style="width:' + pct + '%"></i></span><span class="an">' + count + '</span></div>';
}
function section(title, rows, max) {
  if (!rows.length) return '<section><h2>' + title + '</h2><p class="mu">暂无数据</p></section>';
  return '<section><h2>' + title + '</h2>' + rows.map(r => barRow(r.key, r.count, max)).join('') + '</section>';
}
function renderDashboard(d) {
  if (!d.configured) return '<!doctype html><meta charset="utf-8"><title>SibyX Analytics</title><body style="font:14px sans-serif;background:#0b1437;color:#e7ecff;padding:24px"><h1>SibyX Analytics</h1><p>Redis 未配置，统计未启用。</p></body>';
  const maxSrc = d.topSources.length ? d.topSources[0].count : 0;
  const maxCamp = d.topCampaigns.length ? d.topCampaigns[0].count : 0;
  const maxCc = d.topCountries.length ? d.topCountries[0].count : 0;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SibyX Analytics</title><style>'
    + 'body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b1437;color:#e7ecff;margin:24px auto;padding:0 24px;max-width:780px}'
    + 'h1{margin:0 0 4px;font-size:20px}.sub{color:#8aa0d8;margin:0 0 20px}'
    + 'section{background:#121a3a;border:1px solid #25305f;border-radius:10px;padding:14px 16px;margin:14px 0}'
    + 'h2{font-size:13px;margin:0 0 10px;color:#9fb2ee;text-transform:uppercase;letter-spacing:.04em}'
    + '.ar{display:flex;align-items:center;gap:10px;margin:6px 0}.al{width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cdd8ff}'
    + '.ab{flex:1;background:#1c2750;border-radius:6px;height:14px;overflow:hidden}.ab i{display:block;height:100%;background:linear-gradient(90deg,#2de2c4,#6c8cff)}'
    + '.an{width:56px;text-align:right;color:#9fb2ee;font-variant-numeric:tabular-nums}'
    + '.kpis{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 4px}.kpi{flex:1;min-width:110px;background:#121a3a;border:1px solid #25305f;border-radius:10px;padding:12px 14px}'
    + '.kpi b{display:block;font-size:22px;color:#fff}.kpi span{color:#8aa0d8;font-size:12px}'
    + '.mu{color:#6b7bb0}.foot{color:#6b7bb0;font-size:12px;margin-top:18px}.err{color:#ff9a9a}'
    + '</style></head><body>'
    + '<h1>SibyX · 匿名访问统计</h1><p class="sub">cookieless · 哈希 IP · 仅聚合</p>'
    + '<div class="kpis">'
    + '<div class="kpi"><b>' + d.total + '</b><span>总访问</span></div>'
    + '<div class="kpi"><b>' + d.today + '</b><span>今日访问</span></div>'
    + '<div class="kpi"><b>' + d.last7 + '</b><span>近 7 日</span></div>'
    + '<div class="kpi"><b>' + d.last30 + '</b><span>近 30 日</span></div>'
    + '<div class="kpi"><b>' + d.uvToday + '</b><span>今日独立访客</span></div>'
    + '<div class="kpi"><b>' + d.uv7 + '</b><span>近 7 日独立</span></div>'
    + '</div>'
    + section('来源域名 Top 10', d.topSources, maxSrc)
    + section('渠道 (campaign) Top 10', d.topCampaigns, maxCamp)
    + section('国家/地区 Top 10', d.topCountries, maxCc)
    + '<p class="foot">数据每次访问匿名聚合；IP 经 HMAC-SHA256 按日加盐并截断，不可还原或跨日关联。'
    + (d.error ? ' <span class="err">查询错误：' + escHtml(d.error) + '</span>' : '') + '</p>'
    + '</body></html>';
}

process.on('SIGINT', () => { console.log('\n[relay] shutting down'); process.exit(0); });
