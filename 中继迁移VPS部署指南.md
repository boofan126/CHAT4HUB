# SibyX · 中继迁移到 VPS 部署指南（Ubuntu + pm2 / systemd）

> 适用对象：想把 SibyX 的 GunDB 中继从「Render 免费层」迁到自有 VPS 的运维人员。
> 关键前提：relay 代码 `relay/relay.js` **无需任何修改**，本指南只讲部署与守护。
> 配套功能：客户端已支持**多中继并行**（逗号分隔），迁到 VPS 后可与 Render 互为冗余。

---

## 0. 为什么要从 Render 迁到 VPS（根因回顾）

经实测（2026-07-14），Render 免费层的中继表现异常：

| 能力 | 本地同款 relay.js | Render 免费层 |
|---|---|---|
| 历史回放（重连后拉旧消息） | ✅ | ✅ |
| **实时转发**（A 发、已连接的 B 立刻收到） | ✅ | ❌ 失效 |

根因是 **Render 免费 Web Service 的 WebSocket 代理不支持 Gun 的「每个 peer 都要被实时反向推送」mesh 广播**。这直接导致「只能看到自己发的消息」——对方新发的过不了中继实时转发。

VPS 的优势：
- ✅ 长连接稳定，WS 实时广播正常 → 跨设备真互通
- ✅ 可上 TLS（`wss://`），避免浏览器混合内容拦截
- ✅ 成本可控（$4–6/月即可）
- ✅ 数据只落你自己的盘，符合「隐私优先」定位

**建议架构**：VPS 中继（主力，常驻）+ Render 中继（冗余）。客户端「中继地址」同时填两个，串行并行冗余。

---

## 1. 准备工作

### 1.1 VPS 选型

| 项目 | 最低要求 | 推荐 |
|---|---|---|
| CPU | 1 vCPU | 1 vCPU |
| 内存 | 512 MB（Gun 极轻量） | 1 GB |
| 磁盘 | 10 GB SSD | 20 GB SSD |
| 系统 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| 带宽 | 不限量 / 1 TB+ | 2 TB+ |

推荐厂商（按性价比）：Hetzner CPX11、Vultr、DigitalOcean Basic、阿里云国际轻量、腾讯云轻量。**月费约 $4–6**。

### 1.2 域名（强烈建议，用于 TLS）

- 准备一个域名（如 `yourdomain.com`），新增一条 **A 记录** `relay.yourdomain.com → 你的 VPS 公网 IP`。
- **没有域名也能跑**：用 `ws://<公网IP>:8765/gun` 直连，但**仅当客户端页面本身是 `http://` 时才不被浏览器拦截**（见第 7 节「混合内容」）。生产必须用 `wss://` + 域名。

### 1.3 连通性

- 能 SSH 登录 VPS。
- 放行端口：**80、443**（走 Nginx+TLS，推荐）或 **8765**（直连，仅测试）。
  - 云厂商「安全组 / 防火墙」要放行；
  - 系统层 `ufw` 也要放行（第 8 节）。

---

## 2. 安装 Node.js（VPS 上）

推荐 NodeSource 的 20.x LTS（与 `render.yaml` 锁定的版本一致）：

```bash
# 以普通用户 + sudo 执行
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node -v   # 期望 v20.x
npm -v
```

> 若偏好版本管理，也可用 `nvm` 装 20.x。但生产服务器建议直接用系统包，省心。

---

## 3. 部署 relay 文件到 VPS

**方式 A（推荐）：git 拉取**，方便日后 `git pull` 升级同步。

```bash
sudo apt-get install -y git
cd /opt
sudo git clone https://github.com/boofan126/CHAT4HUB.git sibyx
# relay 实际在仓库根目录的 relay/ 子目录
ls /opt/sibyx/relay
```

**方式 B：scp 直传**（不想暴露仓库结构时）。

```bash
# 在本机执行
scp -r D:/chat4/relay user@<VPS_IP>:/opt/sibyx-relay
```

> 本文后续以 `RELAY_DIR=/opt/sibyx/relay` 为例。若用方式 B，替换为你的实际路径。

---

## 4. 安装依赖

```bash
cd /opt/sibyx/relay
sudo npm install --omit=dev --prefer-online
# 确认 gun / express 装好
ls node_modules | grep -E '^(gun|express)$'
```

依赖极简：`express`、`gun`、`@upstash/redis`（仅当你配置了 Upstash 才真正用到，未配置时 analytics 自动降级、不影响中继）。

---

## 5. 方式一：pm2 守护（推荐入门）

最简单、最易热重启，适合单人维护。

```bash
# 全局装 pm2
sudo npm install -g pm2

# 用生产环境变量启动
cd /opt/sibyx/relay
PORT=8765 GUN_FILE=./data pm2 start relay.js \
  --name sibyx-relay \
  --env production

# 设为开机自启 + 保存当前进程列表
pm2 save
pm2 startup        # 按提示执行它打印出的命令（通常 sudo env ...）
```

常用命令：

```bash
pm2 status                       # 看状态
pm2 logs sibyx-relay           # 看实时日志
pm2 restart sibyx-relay        # 重启（升级代码后）
pm2 stop sibyx-relay           # 停止
pm2 delete sibyx-relay         # 删除
```

> pm2 会把日志写到 `~/.pm2/logs/`。建议定期 `pm2 logrotate`（pm2 自带模块）防止日志撑爆磁盘。

---

## 6. 方式二：systemd 守护（生产更稳）

比 pm2 更「系统原生」，不依赖额外 Node 进程框架，重启策略由 systemd 统一管理。

### 6.1 建专用运行用户（安全）

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /opt/sibyx/relay sibyx
sudo chown -R sibyx:sibyx /opt/sibyx/relay
```

### 6.2 写 service 文件

`/etc/systemd/system/sibyx-relay.service`：

```ini
[Unit]
Description=SibyX GunDB Relay
After=network.target

[Service]
Type=simple
User=sibyx
Group=sibyx
WorkingDirectory=/opt/sibyx/relay
ExecStart=/usr/bin/node /opt/sibyx/relay/relay.js
Restart=on-failure
RestartSec=5
# 环境变量（按需增删）
Environment=PORT=8765
Environment=GUN_FILE=./data
# Environment=ADMIN_TOKEN=换成强随机串
# Environment=UPSTASH_REDIS_REST_URL=...
# Environment=UPSTASH_REDIS_REST_TOKEN=...
# Environment=IP_SALT=换成随机串

[Install]
WantedBy=multi-user.target
```

### 6.3 启用并启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sibyx-relay
sudo systemctl status sibyx-relay --no-pager

# 看日志
sudo journalctl -u sibyx-relay -f
```

> 升级代码后：`sudo systemctl restart sibyx-relay`。

---

## 7. 反向代理 + TLS（关键！HTTPS 页面必须 wss）

### 7.1 为什么一定要 TLS

SibyX 前端部署在 **HTTPS**（Render 静态站是 HTTPS）。浏览器对 HTTPS 页面里的 `ws://`（明文 WebSocket）会按「混合内容」**直接拦截**。所以中继对外必须提供 `wss://`（TLS 加密的 WebSocket）。

做法：在 VPS 上用 **Nginx 做反向代理 + Let's Encrypt 免费证书**终止 TLS，后端仍是本地 `http://127.0.0.1:8765`。

### 7.2 安装 Nginx + certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 7.3 Nginx 配置

`/etc/nginx/sites-available/sibyx-relay`：

```nginx
server {
    listen 80;
    server_name relay.yourdomain.com;

    # Let's Encrypt 验证用，先留着，certbot 会自动加 443
    location /.well-known/acme-challenge/ { root /var/www/html; }

    # 其余先转给 relay（certbot 接管路线前临时用，也可直接 proxy）
    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Gun 是长连接，超时拉满避免被 nginx 切断
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

启用并申请证书：

```bash
sudo ln -s /etc/nginx/sites-available/sibyx-relay /etc/nginx/sites-enabled/
sudo nginx -t                 # 语法检查
sudo systemctl reload nginx
sudo certbot --nginx -d relay.yourdomain.com
```

certbot 会自动把 `listen 80` 改为 `listen 443 ssl` 并补证书路径。证书 90 天自动续期（certbot 安装时已写入 systemd timer）。

### 7.4 验证 TLS 中继

```bash
# 健康检查（应返回 JSON {ok:true}）
curl -s https://relay.yourdomain.com/healthz

# 浏览器 / 客户端连接地址即：
#   wss://relay.yourdomain.com/gun
```

---

## 8. 防火墙

### 8.1 系统层（ufw）

若走 Nginx（推荐）：只需放行 80/443，8765 只监听本机，不必对外。

```bash
sudo ufw allow OpenSSH      # 先保住 SSH，避免把自己锁外面
sudo ufw allow 'Nginx Full' # 放行 80+443
sudo ufw enable
sudo ufw status
```

若直连（仅测试、无 Nginx）：

```bash
sudo ufw allow 8765/tcp
```

### 8.2 云厂商安全组

在 VPS 控制台的安全组里，入站放行：**TCP 80、TCP 443**（走 Nginx）或 **TCP 8765**（直连）。来源 `0.0.0.0/0`。

> ⚠️ 系统防火墙和云安全组**两者都要放行**，只开一个仍连不上。

---

## 9. 验证「实时转发」是否真的修好了（决定性测试）

部署完，**务必用两个独立进程测一次**（同进程共享本地 hub 走 loopback，测不出真转发）：

在 VPS 的 `relay/` 目录里新建 `_verify.js`：

```js
// _verify.js —— 收到任何消息就打印，用于验证实时转发
const Gun = require('gun');
const gun = Gun({ peers: ['wss://relay.yourdomain.com/gun'], localStorage:false, radisk:false });
const TAG = process.argv[2] || 'B';
gun.get('web3chat').map().on(d => {
  if (!d || !d.text) return;
  console.log(`[${TAG}] 收到:`, d.text, '| ctx=', d.ctx, '| from=', (d.address||'').slice(0,8));
});
console.log(`[${TAG}] 已订阅 web3chat，等待消息…`);
setTimeout(() => process.exit(0), 30000);
```

开两个 SSH 会话（或 `nohup`）：

```bash
# 会话 A（发送端，等 5 秒后发）
node -e "const G=require('gun');const g=G({peers:['wss://relay.yourdomain.com/gun'],localStorage:false,radisk:false});setTimeout(()=>{g.get('web3chat').set({id:'v'+Date.now(),text:'HELLO_VPS_'+Date.now(),ctx:'global',address:'verifyA'});console.log('A 已发送');setTimeout(()=>process.exit(0),25000);},5000);"

# 会话 B（接收端，先订阅）
node _verify.js B
```

**判定**：
- ✅ B 在 30s 内打印出 `HELLO_VPS_...` → 实时转发正常，迁移成功。
- ❌ B 一条都没收到 → 检查 Nginx WS 升级头、防火墙、relay 进程是否真在跑。

测完删掉 `_verify.js`。

---

## 10. 客户端配置（多中继并行）

在 SibyX 任意一端的「中继地址」输入框，填入**逗号分隔**的多个地址：

```
https://chat4hub-relay.onrender.com/gun,https://relay.yourdomain.com/gun
```

- App 会 `Gun({ peers: [url1, url2] })` **并行连接所有中继，互为冗余**。
- 只要其中一个（你的 VPS）能正常实时转发，跨设备互看就恢复。
- 即使 Render 那个仍「只重放不转发」，也不再是单点瓶颈。

> 修改后若同步开关开着，App 会立即重连到新地址列表。

---

## 11. 环境变量说明

| 变量 | 默认值 | 作用 | 必填 |
|---|---|---|---|
| `PORT` | `8765` | 中继监听端口 | 否 |
| `GUN_FILE` | `./data` | Gun 图数据落盘目录（重启后仍在） | 否 |
| `ADMIN_TOKEN` | 无 | `/admin` 统计面板访问令牌（Bearer 或 `?token=`） | 否 |
| `UPSTASH_REDIS_REST_URL` | 无 | Upstash Redis REST URL（访问统计） | 否* |
| `UPSTASH_REDIS_REST_TOKEN` | 无 | Upstash Redis REST Token | 否* |
| `IP_SALT` | `sibyx-default-salt-change-me` | IP 哈希加盐（建议改成随机串） | 否 |

> *未配置 Upstash 时，`analytics` 模块会优雅降级（打印一次警告、不记录访客），**不影响中继本身**。
> 配置方式（pm2）：`pm2 start relay.js --name sibyx-relay --env production` 前先 `export VAR=值`；或写入 `.env` 配合 `pm2`/`dotenv`（当前 relay.js 直接读 `process.env`，无需 dotenv）。
> systemd：在 `[Service]` 段用 `Environment=` 逐行声明。

---

## 12. 升级与回滚

```bash
# 方式 A（git 拉取）
cd /opt/sibyx && sudo git pull
sudo chown -R sibyx:sibyx /opt/sibyx/relay   # 若用 systemd 专用用户
# pm2:
pm2 restart sibyx-relay
# 或 systemd:
sudo systemctl restart sibyx-relay

# 回滚（git 时）
cd /opt/sibyx && sudo git checkout <旧commit>
sudo systemctl restart sibyx-relay
```

前端（静态站）的「中继地址」改了之后，记得 push 到 GitHub 触发 Render 重部署（或手动在 Render 控制台重试）。

---

## 13. 故障排查表

| 现象 | 可能原因 | 排查/修复 |
|---|---|---|
| 浏览器控制台报「Mixed Content」 | 页面 HTTPS 但中继用了 `ws://` | 必须上 `wss://`（第 7 节 Nginx+TLS） |
| `wss://relay.domain.com/gun` 连不上 | 防火墙/安全组未放行 443 | `sudo ufw status` + 云控制台检查；`curl -s https://relay.domain.com/healthz` 先验证 443 通 |
| 能 `/healthz` 但收不到实时消息 | Nginx 没配 WebSocket 升级头 | 确认 `proxy_set_header Upgrade $http_upgrade; Connection "upgrade";` 且 `proxy_read_timeout` 够大 |
| relay 进程起不来 | 依赖没装 / 端口被占 | `journalctl -u sibyx-relay -e` 或 `pm2 logs`；`lsof -i:8765` 查占用 |
| 重启后历史消息没了 | `GUN_FILE` 指向了临时/被清目录 | 固定 `GUN_FILE=./data` 并确认该目录持久（别放 `/tmp`） |
| 多中继仍只收到自己 | 两个地址其实都「只重放不转发」 | 确保至少一个（VPS）是真能实时转发的；用第 9 节脚本验证 |

---

## 14. 成本对比

| 方案 | 月费 | 实时转发 | 休眠 | 维护成本 |
|---|---|---|---|---|
| Render 免费层 | $0 | ❌ 失效 | 15min 休眠 | 低 |
| **VPS（本指南）** | **$4–6** | ✅ 正常 | 永不休眠 | 中（需管服务器） |
| Render Basic | $7 | 未必修（WS 代理问题） | 不休眠 | 低 |
| Fly.io / 类似 | $0–5 | ✅ 正常 | 看档位 | 中 |

**结论**：要真正解决「收不到别人消息」，最稳且最便宜的路子就是**自有 VPS 跑 `relay.js` + Nginx TLS**。配合多中继，Render 免费层可继续当冗余，零额外成本。

---

_文档版本：2026-07-14 · 配套 SibyX 客户端已支持多中继并行（commit 353d35d 起）_
