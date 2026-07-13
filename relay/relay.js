/* =====================================================================
 * Web3 本地聊天 · 自建 GunDB 中继（Relay）
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

const app = express();
app.use(Gun.serve); // Gun 提供的静态/握手中间件

const PORT = process.env.PORT || 8765;
const server = app.listen(PORT, () => {
  console.log('[relay] GunDB relay listening on http://0.0.0.0:' + PORT + '/gun');
});

// 把中继挂在同一个 http server 上
Gun({
  web: server,
  file: process.env.GUN_FILE || './data', // 中继图数据落盘（重启后仍在）
  radisk: true,
});

// 健康检查（方便托管平台探测）
app.get('/', (req, res) => res.send('Web3 chat GunDB relay is running.'));
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

process.on('SIGINT', () => { console.log('\n[relay] shutting down'); process.exit(0); });
