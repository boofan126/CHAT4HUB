/* =====================================================================
 * SibyX · 匿名访问统计模块（B 档）
 * ---------------------------------------------------------------------
 * 设计原则（与「隐私优先 / 无采集」定位一致）：
 *   - 不写 cookie、不用 localStorage、不做设备指纹
 *   - 访客 IP 在**服务端**经 HMAC-SHA256 + 按日加盐 + 截断 16 位处理
 *     → 不可逆、且跨日不可关联
 *   - referrer 只存来源域名（不含完整路径）
 *   - 国家只存 Cloudflare 的 cf-ipcountry 国家码（无城市级）
 *   - 仅做聚合，不做个体追踪
 *
 * 持久化：Upstash Redis（Render 文件系统临时，重启即丢，故用外部 KV）
 *   - visits:total / visits:<YYYY-MM-DD>        计数器
 *   - uv:<day>                                  HyperLogLog 独立访客
 *   - src:rank / camp:rank / cc:rank           Sorted Set 排行
 *
 * 未配置 Upstash 环境变量时：record/summary 优雅降级（不崩中继，不记录）。
 * ===================================================================== */

'use strict';

const crypto = require('crypto');

let _redis = null;
let _warned = false;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!_warned) { console.warn('[analytics] UPSTASH_REDIS_* 未配置，统计停用（访客数据不记录）。'); _warned = true; }
    return null;
  }
  try {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token });
  } catch (e) {
    if (!_warned) { console.warn('[analytics] @upstash/redis 加载失败：', e.message); _warned = true; }
    return null;
  }
  return _redis;
}

// HMAC-SHA256 + 按日加盐 + 截断 16 hex（64-bit）
// 同日同 IP 稳定（可去重），跨日不同（不可关联）
function ipHash(ip, day) {
  const salt = process.env.IP_SALT || 'sibyx-default-salt-change-me';
  return crypto.createHmac('sha256', salt).update((ip || '0.0.0.0') + '|' + day).digest('hex').slice(0, 16);
}

function lastNDays(n) {
  const out = [];
  const base = Date.now();
  for (let i = 0; i < n; i++) {
    out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function toNum(v) { return Number(v) || 0; }

// 把 Upstash 返回的 [member, score, member, score, ...] 转成对象数组
function fmtZ(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += 2) out.push({ key: arr[i], count: toNum(arr[i + 1]) });
  return out;
}

async function record({ ip, day, path, ref, camp, cc }) {
  const r = getRedis();
  if (!r) return;
  try {
    const h = ipHash(ip, day);
    await r.incr('visits:total');
    await r.incr('visits:' + day);
    await r.pfadd('uv:' + day, h);
    if (ref && ref !== 'direct') await r.zincrby('src:rank', 1, String(ref).slice(0, 80));
    if (camp && camp !== 'direct') await r.zincrby('camp:rank', 1, String(camp).slice(0, 40));
    if (cc && cc !== 'XX' && cc !== '') await r.zincrby('cc:rank', 1, String(cc).slice(0, 2).toUpperCase());
  } catch (e) {
    if (!_warned) { console.warn('[analytics] 写入失败：', e.message); _warned = true; }
  }
}

async function summary() {
  const r = getRedis();
  const out = { configured: !!r, ts: Date.now() };
  if (!r) return out;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const d7 = lastNDays(7);
    const d30 = lastNDays(30);

    const [total, today, uvToday, topSrc, topCamp, topCc] = await Promise.all([
      r.get('visits:total'),
      r.get('visits:' + day),
      r.pfcount('uv:' + day),
      r.zrange('src:rank', 0, 9, { rev: true, withScores: true }),
      r.zrange('camp:rank', 0, 9, { rev: true, withScores: true }),
      r.zrange('cc:rank', 0, 9, { rev: true, withScores: true }),
    ]);

    const [vis7, vis30] = await Promise.all([
      Promise.all(d7.map(d => r.get('visits:' + d))),
      Promise.all(d30.map(d => r.get('visits:' + d))),
    ]);
    const sum = arr => arr.reduce((a, v) => a + toNum(v), 0);

    // 近 7 日独立访客：PFMERGE 临时键后 PFCOUNT
    let uv7 = 0;
    try {
      await r.pfmerge('uv:tmp', ...d7.map(d => 'uv:' + d));
      uv7 = toNum(await r.pfcount('uv:tmp'));
      await r.del('uv:tmp');
    } catch (e) { uv7 = 0; }

    out.total = toNum(total);
    out.today = toNum(today);
    out.last7 = sum(vis7);
    out.last30 = sum(vis30);
    out.uvToday = toNum(uvToday);
    out.uv7 = uv7;
    out.topSources = fmtZ(topSrc);
    out.topCampaigns = fmtZ(topCamp);
    out.topCountries = fmtZ(topCc);
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

module.exports = { record, summary, ipHash };
