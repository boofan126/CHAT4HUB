/* =====================================================================
 * Web3 本地聊天 · 频道 / 私聊 / 好友  + 私聊端到端加密
 * - 登录：方案 A —— 浏览器本地自动生成身份，无密码/无钱包/无 SIWE
 * - 存储：聊天记录仅存本浏览器 IndexedDB
 * - 密钥：两对独立密钥
 *     ① 签名密钥 ECDSA P-256 —— 用于消息签名 / 验真 / 派生地址
 *     ② 加密密钥 ECDH  P-256 —— 用于私聊端到端加密（派生 AES-GCM）
 * - 频道：公开消息，签名（验真）但不加密
 * - 私聊：ECDH 派生共享密钥 + AES-GCM 端到端加密，中继只见密文
 * - 好友：本地通讯录（地址 + 签名公钥 + 加密公钥），用于发起加密私聊
 * - 同步：可选 GunDB P2P 中继（默认关闭，纯本地）
 * ===================================================================== */

'use strict';

/* ---------- 国际化 i18n（中 / EN） ---------- */
const I18N = {
  zh: {
    brandTitle: 'Web3 本地聊天',
    howTo: '使用说明', howToTitle: '查看使用说明（新页面）',
    modeLocal: '本地模式',
    modeDecentral: '去中心化',
    notLoggedIn: '未登录',
    identityHead: '身份 Identity',
    addrTitle: '你的本地身份地址',
    export: '导出身份', exportTitle: '导出完整身份（含私钥+地址，慎传）',
    exportIdWarn: '⚠️ 警告：身份文件包含你的私钥（签名私钥 + 加密私钥）和地址。\n任何人拿到都能冒充你、并解密你所有端到端私聊历史。\n仅用于本人设备迁移/备份，且绝不发给他人。\n\n确定要导出身份文件吗？',
    import: '导入身份', importTitle: '导入身份文件（恢复同一地址与密钥）',
    logout: '登出', logoutTitle: '清空本地身份与所有记录',
    channels: '频道 Channels',
    chanList: '频道列表',
    newChannelPh: '新频道名',
    join: '加入',
    friends: '好友 Friends',
    addFriendTitle: '手动添加好友（需对方公钥）',
    myPubKey: '我的公钥',
    myPubHint: '把这段发给对方，对方才能给你发加密私聊',
    viewPub: '查看公钥',
    pubHintBody: '把下面这串公钥卡片发给好友，对方即可添加你并收发端到端加密私聊：',
    showAll: (n) => '显示全部 ' + n + ' 条',
    collapseList: '收起',
    copy: '复制',
    ctxNone: '# 未选择',
    dmPrefix: '🔒 私聊 · ',
    channelPrefix: '# ',
    msgInputPh: '输入消息，回车发送…（私聊内容将被端到端加密）',
    send: '发送',
    syncLabel: '去中心化同步（GunDB P2P）',
    syncTitle: '同步 Sync',
    relayPh: '中继地址（需含 /gun）',
    nickLabel: '昵称',
    nickPh: '你的昵称（本机显示，并随消息发给对方）',
    exportMsgs: '导出记录', importMsgs: '导入记录',
    exportMsgsTitle: '导出全部聊天记录（JSON）', importMsgsTitle: '从备份文件导入聊天记录',
    importMsgOk: (n) => '已导入 ' + n + ' 条消息。',
    importMsgFail: '导入失败：',
    attachTitle: '附加文件（图片随消息发送，≤ 1.2 MB）',
    attachBtn: '附件',
    fileTooBig: '附件请小于 2 MB。图片已自动压缩；若仍过大，请改用更小的文件或截图。',
    fileTooBigTitle: '文件过大',
    ok: '确定',
    syncHintOff: '关闭：聊天记录仅存于本浏览器（IndexedDB）。',
    syncHintOn: '开启：消息经中继同步，本机仍留存全部记录（私聊为密文）。',
    syncLive: '✅ 已连接中继，联机同步中。',
    syncDown: '⚠️ 与中继连接中断，正在自动重连…',
    relayEdit: '修改中继地址',
    save: '保存',
    cancel: '取消',
    relaySaved: '中继地址已更新，正在重新连接…',
    noGun: '未加载 GunDB（可能离线），已回退纯本地模式。',
    emptyDM: '端到端加密私聊已开启，内容仅你与对方可读。',
    emptyChannel: '频道为空，发送第一条（公开签名消息）。',
    verified: '✓ 已验证', unverified: '✗ 验签失败',
    e2ee: '🔒 E2EE',
    addFriendBtn: '＋好友',
    lackKeyDecrypt: '🔒 缺少对方公钥，无法解密',
    cannotDecrypt: '🔒 无法解密（密钥不匹配）',
    dmNoKey: '该好友缺少加密公钥，无法加密。请让对方在频道发条消息后点「＋好友」（自动带公钥），或用其「公钥卡片」添加。',
    pasteCard: '粘贴好友的「公钥卡片」（在对方客户端点「复制我的公钥」得到）：',
    friendAdded: '好友已添加：',
    addFailed: '添加失败：',
    copied: '已复制你的「公钥卡片」，发给好友即可被加为好友并收发加密私聊。',
    importOk: '身份导入成功',
    importFail: '导入失败：',
    logoutConfirm: '确认登出？将清空本地身份与全部聊天/好友记录（不可恢复）。',
    initFail: '初始化失败：',
    initFailTip: '\n（注意：crypto.subtle 需安全上下文，请用 localhost 或 https 打开）',
    delFriend: '删除好友',
    delChannel: '删除',
    delChannelConfirm: (n) => '确认删除频道「' + n + '」？该频道内的所有本地消息也将一并清除（不可恢复）。',
    emojiTitle: '表情 / 表情包',
    emojiTabEmoji: '表情',
    emojiTabSticker: '表情包',
    stickerFail: '表情包加载失败（可能离线），已退化为文字表情。',
    channelDup: (n) => '频道「' + n + '」在网络中已存在，已为你加入（不能重复创建）。',
    privateChk: '🔒 私有（加密成员制）',
    memberBtn: '👥 成员',
    chanNoKey: '🔒 加密消息，需批准加入后查看',
    applyJoin: '申请加入',
    joinRequested: '已申请加入，等待批准…',
    pendingReq: '待批准申请：',
    noPending: '暂无待批准申请',
    approve: '批准',
    kick: '踢出',
    roleCreator: '创建者',
    roleApprover: '审批人',
    notMember: '你还不是成员',
    privateHint: '私有频道：消息端到端加密，仅被批准成员可解密。',
    kickConfirm: (n) => '确认将「' + n + '」移出频道？将更换密钥，该成员此后无法读取新消息（历史保留）。',
    onlyCreatorKick: '仅创建者可踢人',
    needApproveToPost: '需被批准加入后才能发言',
    metaLoadFail: '读取频道信息失败',
    openChannelHint: '开放频道：任何知道名称的人都能加入并查看消息。',
    newReq: (n) => (n > 1 ? n + ' 项新成员申请' : '1 项新成员申请'),
    memberList: (n) => '成员列表（' + n + '）',
    welcomeTitle: '绝对安全的信息交流',
    welcomeSub: '端到端加密 · 去中心化网络 · 你的密钥只在你手中',
    enterApp: '开始使用 →',
    pageTitle: 'Web3Chat · 本地加密聊天',
    welcomeFoot: 'Web3Chat · 隐私优先的本地加密聊天',
    imgTag: '[图片] ',
    fileTag: '[文件] ',
    cancelAttach: '取消附件',
    fmtInvalid: '格式不正确',
    idFileInvalid: '身份文件格式不正确',
    connecting: '连接中…',
    collapseTip: '折叠 / 展开',
    closeTip: '关闭',
  },
  en: {
    brandTitle: 'Web3 Local Chat',
    howTo: 'How to Use', howToTitle: 'Open the user guide (new page)',
    modeLocal: 'Local', 
    modeDecentral: 'Decentralized',
    notLoggedIn: 'Not signed in',
    identityHead: 'Identity',
    addrTitle: 'Your local identity address',
    export: 'Export Identity', exportTitle: 'Export full identity (incl. private keys + address, keep safe)',
    exportIdWarn: '⚠️ WARNING: the identity file contains your PRIVATE keys (signing + encryption) and address.\nAnyone who gets it can impersonate you and decrypt all your E2E DM history.\nUse ONLY for your own device migration/backup, never share it.\n\nProceed with identity export?',
    import: 'Import Identity', importTitle: 'Import an identity file (restores same address & keys)',
    logout: 'Logout', logoutTitle: 'Clear local identity and all records',
    channels: 'Channels',
    chanList: 'Channel List',
    newChannelPh: 'New channel name',
    join: 'Join',
    friends: 'Friends',
    addFriendTitle: 'Add a friend manually (needs their public key)',
    myPubKey: 'My Public Key',
    myPubHint: 'Send this to others so they can send you encrypted DMs',
    viewPub: 'View Public Key',
    pubHintBody: 'Send the public key card below to friends so they can add you and exchange end-to-end encrypted DMs:',
    showAll: (n) => 'Show all ' + n,
    collapseList: 'Collapse',
    copy: 'Copy',
    ctxNone: '# none',
    dmPrefix: '🔒 DM · ',
    channelPrefix: '# ',
    msgInputPh: 'Type a message, Enter to send… (DMs are end-to-end encrypted)',
    send: 'Send',
    syncLabel: 'Decentralized Sync (GunDB P2P)',
    syncTitle: 'Sync',
    relayPh: 'Relay URL (must include /gun)',
    nickLabel: 'Nickname',
    nickPh: 'Your nickname (shown locally, sent to peers with messages)',
    exportMsgs: 'Export', importMsgs: 'Import',
    exportMsgsTitle: 'Export all chat history (JSON)', importMsgsTitle: 'Import chat history from a backup file',
    attachTitle: 'Attach a file (images sent with message, ≤ 1.2 MB)',
    attachBtn: 'Attach',
    fileTooBig: 'Attachments must be under 2 MB. Images are auto-compressed; if still too large, use a smaller file or a screenshot.',
    fileTooBigTitle: 'File too large',
    ok: 'OK',
    importMsgOk: (n) => 'Imported ' + n + ' messages.',
    importMsgFail: 'Import failed: ',
    syncHintOff: 'Off: chat records are stored only in this browser (IndexedDB).',
    syncHintOn: 'On: messages sync via relay; all records still kept locally (DMs stay ciphertext).',
    syncLive: '✅ Connected to relay, syncing live.',
    syncDown: '⚠️ Relay connection lost, auto-reconnecting…',
    relayEdit: 'Edit relay address',
    save: 'Save',
    cancel: 'Cancel',
    relaySaved: 'Relay address updated, reconnecting…',
    noGun: 'GunDB not loaded (maybe offline), fell back to local-only mode.',
    emptyDM: 'End-to-end encrypted DM enabled — only you and your peer can read it.',
    emptyChannel: 'Channel is empty. Send the first (public, signed) message.',
    verified: '✓ Verified', unverified: '✗ Verify failed',
    e2ee: '🔒 E2EE',
    addFriendBtn: '+Friend',
    lackKeyDecrypt: '🔒 Missing peer public key, cannot decrypt',
    cannotDecrypt: '🔒 Cannot decrypt (key mismatch)',
    dmNoKey: 'This friend has no encryption key, cannot encrypt. Ask them to post in a channel then click "+Friend" (auto-includes keys), or add via their "public key card".',
    pasteCard: 'Paste your friend\'s "public key card" (they get it via "Copy My Public Key"):',
    friendAdded: 'Friend added: ',
    addFailed: 'Add failed: ',
    copied: 'Your "public key card" is copied. Send it to friends so they can add you and exchange encrypted DMs.',
    importOk: 'Identity imported successfully',
    importFail: 'Import failed: ',
    logoutConfirm: 'Confirm logout? This clears your local identity and all chat/friend records (irreversible).',
    initFail: 'Init failed: ',
    initFailTip: '\n(Note: crypto.subtle needs a secure context — open via localhost or https)',
    delFriend: 'Remove friend',
    delChannel: 'Delete',
    delChannelConfirm: (n) => 'Delete channel "' + n + '"? All local messages in it will also be cleared (irreversible).',
    emojiTitle: 'Emoji / Stickers',
    emojiTabEmoji: 'Emoji',
    emojiTabSticker: 'Stickers',
    stickerFail: 'Sticker load failed (maybe offline), fell back to text emoji.',
    channelDup: (n) => 'Channel "' + n + '" already exists on the network; joined it for you (cannot create a duplicate).',
    privateChk: '🔒 Private (encrypted membership)',
    memberBtn: '👥 Members',
    chanNoKey: '🔒 Encrypted — join by approval to view',
    applyJoin: 'Request to join',
    joinRequested: 'Join requested, awaiting approval…',
    pendingReq: 'Pending requests:',
    noPending: 'No pending requests',
    approve: 'Approve',
    kick: 'Kick',
    roleCreator: 'Creator',
    roleApprover: 'Approver',
    notMember: 'You are not a member',
    privateHint: 'Private channel: messages are end-to-end encrypted; only approved members can read them.',
    kickConfirm: (n) => 'Remove "' + n + '" from the channel? The key will rotate; they can no longer read new messages (history kept).',
    onlyCreatorKick: 'Only the creator can kick',
    needApproveToPost: 'Need approval to post',
    metaLoadFail: 'Failed to load channel info',
    openChannelHint: 'Open channel: anyone who knows the name can join and read messages.',
    newReq: (n) => (n > 1 ? n + ' new join requests' : '1 new join request'),
    memberList: (n) => 'Member list (' + n + ')',
    welcomeTitle: 'Absolutely Secure Communication',
    welcomeSub: 'End-to-end encryption · Decentralized network · Your keys stay with you',
    enterApp: 'Get Started →',
    pageTitle: 'Web3Chat · Encrypted Local Chat',
    welcomeFoot: 'Web3Chat · Privacy-first encrypted chat',
    imgTag: '[Image] ',
    fileTag: '[File] ',
    cancelAttach: 'Cancel attachment',
    fmtInvalid: 'Invalid format',
    idFileInvalid: 'Invalid identity file format',
    connecting: 'Connecting…',
    collapseTip: 'Collapse / Expand',
    closeTip: 'Close',
  },
};
let LANG = 'en';
const LANG_ATTR = { zh: 'zh-CN', en: 'en' };
function t(key, arg) {
  const v = (I18N[LANG] && I18N[LANG][key]) != null ? I18N[LANG][key] : (I18N.zh[key] != null ? I18N.zh[key] : key);
  return typeof v === 'function' ? v(arg) : v;
}
function applyI18n() {
  document.documentElement.lang = LANG_ATTR[LANG] || 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
  // 动态区域重渲染
  if (state.address) { $('addrLabel').textContent = shortAddr(state.address); }
  renderCtxHeader();
  setModeText();
  renderChannelList();   // 刷新动态文案（删除按钮标题等）
  renderFriendList();
}
async function setLang(lang) {
  if (!I18N[lang]) lang = 'en';   // 未知语言回退 en
  LANG = lang;
  await idbPut('meta', { key: 'lang', value: LANG });
  applyI18n();
  renderMessages();
}
/* 跟随浏览器/系统语言自动选择（仅当用户未手动覆盖时） */
function detectLang() {
  const prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  for (const p of prefs) {
    const l = (p || '').toLowerCase();
    if (l.startsWith('zh')) return 'zh';
    if (l.startsWith('en')) return 'en';
  }
  return 'en'; // 兜底
}

/* ---------- 中继地址（可配置） ---------- */
// 默认指向本机自建中继；部署后请在界面「中继地址」里改成你自己的中继 URL（需含 /gun 路径）。
// 注意：GunDB 中继是 Node 服务，免费静态托管（GitHub Pages 等）跑不了，须放能跑 Node 的环境。
const RELAY_URL = 'https://chat4hub-relay.onrender.com/gun';
// 附件大小上限：2 MB。图片发送前自动压缩到上限内；非图片(如 PDF/视频)超过则弹窗提示。保护免费中继不被大文件拖垮。
const MAX_ATTACH_BYTES = 2 * 1024 * 1024;

/* ---------- 表情 / 表情包（公开资源：Twemoji，MIT / CC-BY-4.0，由 jsDelivr 分发） ---------- */
// 贴图图片基址：<code>.png 即 Twemoji 72x72 位图（联网加载，点击作为图片附件发送）
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/';
// 「表情」标签：常用 Unicode emoji（离线可用，点击插入输入框）
const EMOJI_LIST = [
  '😀','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😍','😘','😎','🤔','🤩','🥳',
  '😜','🤪','😭','😡','🥺','😏','😬','🤗','🤤','🤐','🤨','🤝','🙏','💪','👍','👎',
  '👏','✌️','👌','🤙','👋','✊','🤛','🤜','❤️','🧡','💛','💚','💙','💜','🖤',
  '💔','🔥','✨','💯','⭐','🌟','💥','✅','❌','⚡','🎯','🚀','💡','📈','💰','🐶',
  '🐱','🌈','☕','🍕','🎂','🍻','🎁','🌹','🍀','🔔','💎','🎉','👀',
];
// 「表情包」标签：公开 Twemoji 贴图（联网加载，[文字, Twemoji codepoint]）
const STICKER_LIST = [
  ['😀','1f600'],['😄','1f604'],['😁','1f601'],['😆','1f606'],['😅','1f605'],['🤣','1f923'],
  ['😂','1f602'],['🙂','1f642'],['😉','1f609'],['😊','1f60a'],['😍','1f60d'],['😘','1f618'],
  ['😎','1f60e'],['🤔','1f914'],['🤩','1f929'],['🥳','1f973'],['😜','1f61c'],['🤪','1f92a'],
  ['😭','1f62d'],['😡','1f621'],['👍','1f44d'],['👎','1f44e'],['👏','1f44f'],['🙏','1f64f'],
  ['💪','1f4aa'],['🤝','1f91d'],['❤️','2764'],['💔','1f494'],['🔥','1f525'],['✨','2728'],
  ['🎉','1f389'],['💯','1f4af'],['🚀','1f680'],['💡','1f4a1'],['👀','1f440'],['⭐','2b50'],
  ['🌟','1f31f'],['🐶','1f436'],['🐱','1f431'],['☕','2615'],['🍕','1f355'],['🎂','1f382'],
  ['🍻','1f37b'],['🎁','1f381'],
];
// 已转成 base64 的贴图缓存（避免重复拉取）
const stickerCache = new Map();

/* ---------- 工具 ---------- */
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToBase64(buf) { const b = new Uint8Array(buf); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }
function base64ToBuf(b64) { const s = atob(b64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

/* ---------- IndexedDB ---------- */
const DB_NAME = 'web3chat';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2); // version 2：新增 friends / meta
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('identity')) d.createObjectStore('identity', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('messages')) {
        const ms = d.createObjectStore('messages', { keyPath: 'id' });
        ms.createIndex('ctx', 'ctx', { unique: false });
        ms.createIndex('ts', 'ts', { unique: false });
      }
      if (!d.objectStoreNames.contains('friends')) d.createObjectStore('friends', { keyPath: 'address' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function idbGet(store, key) {
  return new Promise((res, rej) => { const t = db.transaction(store, 'readonly'); const r = t.objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function idbPut(store, val) {
  return new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).put(val); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
function idbGetAll(store) {
  return new Promise((res, rej) => { const t = db.transaction(store, 'readonly'); const r = t.objectStore(store).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
}
function idbDelete(store, key) {
  return new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
function idbClear(store) {
  return new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

/* ---------- 身份（方案 A） ---------- */
const state = {
  signPriv: null, signPub: null, signPubB64: null,   // ECDSA —— 签名/地址
  dhPriv: null, dhPubB64: null,                       // ECDH  —— 端到端加密
  address: null,
  nickname: '',                                          // 使用者自设昵称（本地显示 + 随消息广播）
  pendingFile: null,                                      // 待发送附件（{name,type,size,data(base64)}）
  syncOn: false,
  relayUrl: RELAY_URL,
  context: { type: 'channel', id: 'global', peer: null },
  channels: [],
  friends: new Map(),
  // —— 路线 B：加密成员制 ——
  channelKeys: {},        // name -> { key: CryptoKey(AES-GCM 256), version: n }  （本机持有，不广播）
  channelMeta: {},        // name -> { kind, creator, keyVersion, members:{}, approvers:{}, membersDh:{} }（网络明文元数据缓存）
  channelRequests: {},    // name -> { addr: { encFrom, ts } }  （待批准申请缓存）
  addrNick: {},           // address -> 最近一次使用的昵称（从消息/申请里收集，用于成员列表展示）
  listExpanded: { channels: false, friends: false },  // 列表是否展开全部（默认仅前5）
  panelCollapsed: { channels: false, friends: false }, // 频道/好友面板是否整体折叠
};
const seen = new Set();

async function deriveAddress(rawBuf) {
  const h = await crypto.subtle.digest('SHA-256', rawBuf);
  const bytes = new Uint8Array(h).slice(-20);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return '0x' + hex;
}

// 生成两对独立密钥：签名(ECDSA) + 加密(ECDH)
async function generateIdentity() {
  const sign = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const dh = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);

  const signPrivJwk = await crypto.subtle.exportKey('jwk', sign.privateKey);
  const signRawPub = await crypto.subtle.exportKey('raw', sign.publicKey);
  const signPubB64 = bufToBase64(signRawPub);

  const dhPrivJwk = await crypto.subtle.exportKey('jwk', dh.privateKey);
  const dhRawPub = await crypto.subtle.exportKey('raw', dh.publicKey);
  const dhPubB64 = bufToBase64(dhRawPub);

  const address = await deriveAddress(signRawPub);
  const rec = { key: 'me', signPrivJwk, signPubB64, dhPrivJwk, dhPubB64, address };
  await idbPut('identity', rec);
  return rec;
}

async function loadIdentity() {
  let rec = await idbGet('identity', 'me');
  if (!rec) rec = await generateIdentity();
  state.signPriv = await crypto.subtle.importKey('jwk', rec.signPrivJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  state.signPub = await crypto.subtle.importKey('raw', base64ToBuf(rec.signPubB64), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  state.dhPriv = await crypto.subtle.importKey('jwk', rec.dhPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  state.address = rec.address;
  state.signPubB64 = rec.signPubB64;
  state.dhPubB64 = rec.dhPubB64;
  state.nickname = rec.nickname || '';
}
// 保存昵称到身份记录（导出/导入身份时一并带走）
async function saveNickname() {
  const rec = await idbGet('identity', 'me');
  if (!rec) return;
  rec.nickname = state.nickname;
  await idbPut('identity', rec);
}

async function exportIdentity() {
  const rec = await idbGet('identity', 'me');
  return JSON.stringify(rec, null, 2);
}

// 导出全部聊天记录（+ 频道列表）为 JSON 备份
async function exportMessages() {
  const msgs = await idbGetAll('messages');
  const payload = { type: 'web3chat-backup', version: 1, exportedAt: Date.now(), channels: state.channels, messages: msgs };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'web3chat-backup.json'; a.click(); URL.revokeObjectURL(a.href);
}
// 从备份导入：按 id 合并去重，并集频道名
async function importMessages(file) {
  try {
    const obj = JSON.parse(await file.text());
    const list = Array.isArray(obj) ? obj : (obj.messages || []);
    if (!Array.isArray(list)) throw new Error('fmtInvalid');
    let n = 0;
    for (const m of list) {
      if (!m || !m.id || !m.sig) continue;
      await idbPut('messages', m); n++; seen.add(m.id);
    }
    if (obj.channels && Array.isArray(obj.channels)) {
      for (const c of obj.channels) if (c && !state.channels.includes(c)) state.channels.push(c);
      await saveChannels();
    }
    renderChannelList(); await renderMessages();
    alert(t('importMsgOk', n));
  } catch (err) { alert(t('importMsgFail') + t(err.message)); }
}

// 「公钥卡片」：把地址 + 签名公钥 + 加密公钥打包，方便好友一键添加
function myPubCard() {
  return JSON.stringify({ addr: state.address, sign: state.signPubB64, dh: state.dhPubB64 });
}

async function importIdentity(json) {
  const rec = JSON.parse(json);
  if (!rec || !rec.signPrivJwk || !rec.signPubB64 || !rec.dhPrivJwk || !rec.dhPubB64 || !rec.address)
    throw new Error('idFileInvalid');
  await idbPut('identity', { key: 'me', ...rec });
  await loadIdentity();
}

/* ---------- 签名 / 验签（ECDSA） ---------- */
async function signMessage(payload) {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, state.signPriv, enc.encode(payload));
  return bufToBase64(sig);
}
async function verifyMessage(pubRawB64, payload, sigB64) {
  try {
    const pub = await crypto.subtle.importKey('raw', base64ToBuf(pubRawB64), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    return !!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, base64ToBuf(sigB64), enc.encode(payload)));
  } catch (e) { return false; }
}

/* ---------- 私聊端到端加密（ECDH → AES-GCM） ---------- */
// 用「我的 ECDH 私钥」+「对方 ECDH 公钥」派生共享 AES 密钥
async function deriveAES(myDhPriv, peerDhPubB64) {
  const peerPub = await crypto.subtle.importKey('raw', base64ToBuf(peerDhPubB64), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPub }, myDhPriv,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function encryptText(aesKey, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text));
  return { iv: bufToBase64(iv.buffer), cipher: bufToBase64(ct) };
}
async function decryptText(aesKey, ivB64, cipherB64) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBuf(ivB64) }, aesKey, base64ToBuf(cipherB64));
  return dec.decode(pt);
}
// 解密时取「对方的 ECDH 公钥」：自己发的用对方 dh 公钥(peerDhPub)，对方发的用其 dh 公钥(dhPub)
function otherPubForDecrypt(m) {
  return (m.address === state.address) ? m.peerDhPub : m.dhPub;
}

/* ---------- 路线 B：频道对称密钥 K（AES-GCM 256，可提取） ---------- */
// 生成一个新的频道密钥 K（用于加密 private 频道的消息/附件）
async function generateChannelKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
// 把 K 导出为 raw 字节 base64（便于经 ECDH 共享密钥再加密后分发给成员）
async function exportChannelKeyRaw(key) {
  const buf = await crypto.subtle.exportKey('raw', key);
  return bufToBase64(buf);
}
async function importChannelKeyRaw(b64) {
  return crypto.subtle.importKey('raw', base64ToBuf(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
// 判断某频道是否为私有（加密成员制）
function channelIsPrivate(name) {
  return !!(state.channelMeta[name] && state.channelMeta[name].kind === 'private');
}
// 本机是否持有某私有频道的 K（= 已是被批准成员）
function haveChannelKey(name) {
  return !!(state.channelKeys[name] && state.channelKeys[name].key);
}

/* 私聊房间 ID：双方地址排序后哈希，保证一致 */
async function dmRoomId(a, b) {
  const s = [a, b].sort().join('|');
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return 'dm_' + [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/* ---------- 元数据 ---------- */
async function loadMeta() {
  const ch = await idbGet('meta', 'channels');
  state.channels = (ch && Array.isArray(ch.value)) ? ch.value : ['global'];
  const sync = await idbGet('meta', 'syncOn');
  // 默认开启去中心化同步；仅当用户曾明确关闭过（存过 false）时才保持关闭
  state.syncOn = sync ? !!sync.value : true;
  const relay = await idbGet('meta', 'relayUrl');
  state.relayUrl = (relay && relay.value) ? relay.value : RELAY_URL;
  const lang = await idbGet('meta', 'lang');
  // 未手动选过语言时，跟随浏览器语言自动设置（detectLang 读 navigator.languages）
  LANG = (lang && I18N[lang.value]) ? lang.value : detectLang();
  const last = await idbGet('meta', 'lastCtx');
  if (last && last.value) state.context = last.value;
  // 路线 B：恢复本机持有的私有频道密钥 K
  const ck = await idbGet('meta', 'channelKeys');
  if (ck && ck.value && typeof ck.value === 'object') {
    for (const [nm, v] of Object.entries(ck.value)) {
      try { state.channelKeys[nm] = { key: await importChannelKeyRaw(v.rawB64), version: v.version || 1 }; } catch (e) {}
    }
  }
  // 路线 B：恢复本机持有的私有频道元数据（创建者/成员/审批人），避免纯本地模式或 Gun 未连时重载丢失
  const cm = await idbGet('meta', 'channelMeta');
  if (cm && cm.value && typeof cm.value === 'object') {
    for (const [nm, v] of Object.entries(cm.value)) {
      state.channelMeta[nm] = { kind: v.kind, creator: v.creator, keyVersion: v.keyVersion, members: v.members || {}, approvers: v.approvers || {}, membersDh: v.membersDh || {} };
    }
  }
}
async function saveChannels() { await idbPut('meta', { key: 'channels', value: state.channels }); }
async function saveChannelKeys() {
  const obj = {};
  for (const [nm, v] of Object.entries(state.channelKeys)) {
    try { obj[nm] = { rawB64: await exportChannelKeyRaw(v.key), version: v.version || 1 }; } catch (e) {}
  }
  await idbPut('meta', { key: 'channelKeys', value: obj });
}
async function saveChannelMeta() {
  const obj = {};
  for (const [nm, v] of Object.entries(state.channelMeta)) {
    obj[nm] = { kind: v.kind, creator: v.creator, keyVersion: v.keyVersion, members: v.members || {}, approvers: v.approvers || {}, membersDh: v.membersDh || {} };
  }
  await idbPut('meta', { key: 'channelMeta', value: obj });
}
async function saveSync() { await idbPut('meta', { key: 'syncOn', value: state.syncOn }); }
async function saveRelay() { await idbPut('meta', { key: 'relayUrl', value: state.relayUrl }); }
async function saveCtx() { await idbPut('meta', { key: 'lastCtx', value: state.context }); }

/* ---------- 好友 ---------- */
async function loadFriends() {
  const list = await idbGetAll('friends');
  state.friends = new Map(list.map(f => [f.address, f]));
}
// address 由签名公钥推导，保证与消息里的地址一致
async function addFriendRaw(address, signPubB64, dhPubB64, nickname) {
  if (!address) return;
  if (state.friends.has(address)) return;
  state.friends.set(address, { address, signPubB64: signPubB64 || null, dhPubRawB64: dhPubB64 || null, nickname: nickname || shortAddr(address) });
  await idbPut('friends', state.friends.get(address));
  renderFriendList();
}
async function removeFriend(address) {
  state.friends.delete(address);
  await idbDelete('friends', address);
  renderFriendList();
  if (state.context.type === 'dm' && state.context.peer && state.context.peer.address === address) {
    switchToChannel(state.channels[0] || 'global');
  }
}

/* ---------- 消息：存 / 取 / 渲染 ---------- */
async function saveMessage(msg) { await idbPut('messages', msg); seen.add(msg.id); }
async function localMessagesForCtx(ctx) {
  const all = await idbGetAll('messages');
  return all.filter(m => m.ctx === ctx).sort((a, b) => a.ts - b.ts);
}
async function renderMessages() {
  const box = $('messages');
  const list = await localMessagesForCtx(state.context.id);
  box.innerHTML = '';
  if (list.length === 0) {
    const e = document.createElement('div'); e.className = 'empty';
    e.textContent = state.context.type === 'dm' ? t('emptyDM') : t('emptyChannel');
    box.appendChild(e); return;
  }
  for (const m of list) box.appendChild(await renderOne(m));
  box.scrollTop = box.scrollHeight;
}
async function renderOne(m) {
  const el = document.createElement('div');
  const mine = m.address === state.address;
  const who = mine
    ? (state.nickname || shortAddr(m.address))
    : (m.nick || shortAddr(m.address));
  if (m.nick) state.addrNick[m.address] = m.nick;   // 收集昵称，供成员列表展示
  el.className = 'msg' + (mine ? ' mine' : '');
  const time = new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  let text, file = null, verified, lockHint = '';
  if (m.kind === 'dm') {
    verified = await verifyMessage(m.pubRawB64, m.cipher, m.sig);
    try {
      const otherPub = otherPubForDecrypt(m);
      const plain = otherPub ? await decryptText(await deriveAES(state.dhPriv, otherPub), m.iv, m.cipher)
                            : t('lackKeyDecrypt');
      // 新版本私聊把 {text,file} 打包成 JSON 再加密；旧版纯文本密文也能兼容
      let obj; try { obj = JSON.parse(plain); } catch (e) { obj = { text: plain }; }
      text = obj.text || '';
      file = obj.file || null;
    } catch (e) { text = t('cannotDecrypt'); }
    lockHint = '<span class="lock">' + t('e2ee') + '</span>';
  } else {
    if (m.cipher) {   // 私有频道加密消息（enc:1）
      verified = await verifyMessage(m.pubRawB64, m.cipher, m.sig);
      const k = state.channelKeys[m.ctx];
      if (k && k.key) {
        try {
          const bundle = JSON.parse(await decryptText(k.key, m.iv, m.cipher));
          text = bundle.text || '';
          file = bundle.file || null;
        } catch (e) { text = t('cannotDecrypt'); }
      } else {
        text = t('chanNoKey');           // 未持 K：看不到明文
        lockHint = '<span class="lock">🔒</span>';
      }
    } else {
      verified = await verifyMessage(m.pubRawB64, m.text, m.sig);
      text = m.text;
      file = m.file || null;
    }
  }

  const vtxt = verified ? t('verified') : t('unverified');
  const vcls = verified ? 'verified' : 'unverified';
  // 非本人且在频道里 → 提供「加好友」（附带其签名公钥 + 加密公钥）
  const canAdd = !mine && m.kind === 'channel' && m.pubRawB64 && m.dhPub && !state.friends.has(m.address);
  const addBtn = canAdd ? `<span class="add" data-addr="${m.address}" data-sign="${m.pubRawB64}" data-dh="${m.dhPub}">${t('addFriendBtn')}</span>` : '';

  el.innerHTML = `
    <div class="meta">
      <span class="who">${who}</span>
      ${lockHint}
      <span class="${vcls}">${vtxt}</span>
      <span>${time}</span>
      ${addBtn}
    </div>
    <div class="body"></div>`;
  const body = el.querySelector('.body');
  body.textContent = text; // textContent 防 XSS
  if (file) body.appendChild(buildAttachment(file)); // 附件用 DOM 构建，防 XSS
  const ab = el.querySelector('.add');
  if (ab) ab.addEventListener('click', () => addFriendRaw(ab.dataset.addr, ab.dataset.sign, ab.dataset.dh));
  return el;
}

// 用 DOM API 构建附件元素（文件名/数据均以属性或 textContent 设置，绝不经 innerHTML 注入）
function buildAttachment(file) {
  const wrap = document.createElement('div'); wrap.className = 'att-wrap';
  if (file.type && file.type.indexOf('image/') === 0) {
    const img = document.createElement('img');
    img.className = 'att'; img.src = file.data;
    img.alt = (t('imgTag') + (file.name || 'image')).trim();
    img.addEventListener('click', () => window.open(file.data, '_blank'));
    wrap.appendChild(img);
    const cap = document.createElement('div'); cap.className = 'att-cap';
    cap.textContent = t('imgTag') + (file.name || 'image');
    wrap.appendChild(cap);
  } else {
    const a = document.createElement('a');
    a.className = 'att-file'; a.href = file.data; a.download = file.name || 'file';
    a.textContent = t('fileTag') + (file.name || 'file') + '  (' + formatSize(file.size || 0) + ')';
    wrap.appendChild(a);
  }
  return wrap;
}
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}
// 待发附件预览（消息框下方的小芯片，可取消）
function renderAttachPreview() {
  const box = $('attachPreview'); if (!box) return;
  const f = state.pendingFile;
  if (!f) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false; box.innerHTML = '';
  const chip = document.createElement('span'); chip.className = 'att-chip';
  chip.textContent = (f.type && f.type.indexOf('image/') === 0 ? t('imgTag') + ' ' : t('fileTag') + ' ') + f.name + ' (' + formatSize(f.size) + ')';
  const x = document.createElement('span'); x.className = 'att-x'; x.textContent = '×'; x.title = t('cancelAttach');
  x.addEventListener('click', () => { state.pendingFile = null; renderAttachPreview(); });
  box.appendChild(chip); box.appendChild(x);
}
function clearAttachPreview() { renderAttachPreview(); }

async function sendMessage() {
  const input = $('msgInput');
  const text = input.value.trim();
  const file = state.pendingFile;            // 待发送附件（可能为 null）
  if (!text && !file) return;               // 既无文字也无附件则不发

  let msg;
  if (state.context.type === 'dm') {
    const peer = state.context.peer;
    if (!peer || !peer.dhPubRawB64) {
      alert(t('dmNoKey'));
      return;
    }
    const aes = await deriveAES(state.dhPriv, peer.dhPubRawB64); // 用我的 ECDH 私钥 + 对方 ECDH 公钥
    // 私聊：把 {text, file} 打包成 JSON 再加密，保证附件也走端到端加密
    const bundle = JSON.stringify({ text: text, file: file || null });
    const { iv, cipher } = await encryptText(aes, bundle);
    const sig = await signMessage(cipher);                        // 对密文签名（用我的 ECDSA 私钥）
    msg = {
      id: crypto.randomUUID(), kind: 'dm', ctx: state.context.id, peer: peer.address,
      address: state.address, pubRawB64: state.signPubB64, dhPub: state.dhPubB64, peerDhPub: peer.dhPubRawB64,
      nick: state.nickname,
      ts: Date.now(), iv, cipher, sig,
    };
  } else {
    const name = state.context.id;
    if (channelIsPrivate(name)) {
      // 私有频道（加密成员制）：用频道密钥 K 加密 {text, file}（附件也一并加密），仅持 K 成员可解密
      if (!haveChannelKey(name)) { alert(t('needApproveToPost')); return; }
      const bundle = JSON.stringify({ text: text, file: file || null });
      const { iv, cipher } = await encryptText(state.channelKeys[name].key, bundle);
      const sig = await signMessage(cipher);            // 对密文签名
      msg = {
        id: crypto.randomUUID(), kind: 'channel', ctx: name, enc: 1,
        address: state.address, pubRawB64: state.signPubB64, dhPub: state.dhPubB64,
        nick: state.nickname,
        ts: Date.now(), iv, cipher, sig,
      };
    } else {
      const sig = await signMessage(text);
      // 关键：不要写 file:undefined —— Gun 对 `file:undefined` 会报 "Invalid data: undefined" 并拒绝同步，
      // 导致对方收不到（这是加附件功能后引入、且会让【纯文本消息也失效】的回归）。无附件时【完全不带 file 字段】，
      // 以恢复「加附件前可正常互发」的状态。
      const msgBase = {
        id: crypto.randomUUID(), kind: 'channel', ctx: name,
        address: state.address, pubRawB64: state.signPubB64, dhPub: state.dhPubB64,
        nick: state.nickname,
        ts: Date.now(), text, sig,
      };
      if (file) msgBase.file = file;   // 仅在有附件时挂上对象（仅供本机渲染；上链前会转成 fileJson）
      msg = msgBase;
    }
  }
  await saveMessage(msg);
  input.value = '';
  state.pendingFile = null; clearAttachPreview();   // 清空待发附件
  await renderMessages();
  if (state.syncOn && gun) {
    // 上链（Gun 中继）规则：
    // ① 纯文本（无 file）→ 不带任何 file 字段（恢复加附件前可正常同步的状态）；
    // ② 有附件 → 把嵌套的 file 对象转成【顶层字符串 fileJson】，并删掉 file（Gun 会把嵌套对象拆成图引用，
    //    接收端/本机重载后会拿到引用而非真实数据 → 显示 file(0B)）。私聊的附件在加密密文里，不受影响。
    const wire = { ...msg };
    if (msg.kind === 'channel' && msg.file) { delete wire.file; wire.fileJson = JSON.stringify(msg.file); }
    else if (msg.kind === 'channel') { delete wire.file; }   // 兜底：去掉可能残留的 file:undefined
    gun.get('web3chat').get(msg.id).put(wire);
  }
}

/* ---------- 上下文切换 ---------- */
function switchToChannel(name) {
  state.context = { type: 'channel', id: name, peer: null };
  if (gun) watchChannelMeta(name);
  saveCtx(); renderCtxHeader(); renderChannelList(); renderMessages(); closeNav();
}
async function switchToDM(friend) {
  const id = await dmRoomId(state.address, friend.address);
  state.context = { type: 'dm', id, peer: friend };
  saveCtx(); renderCtxHeader(); renderFriendList(); renderMessages(); closeNav();
}
function renderCtxHeader() {
  const h = $('ctxHeader');
  if (!h) return;
  const title = $('ctxTitle');
  const mb = $('memberBtn');
  if (state.context.type === 'dm') {
    const p = state.context.peer;
    if (title) title.textContent = t('dmPrefix') + (p ? (p.nickname || shortAddr(p.address)) : '');
    if (mb) mb.hidden = true;
  } else {
    if (title) title.textContent = (channelIsPrivate(state.context.id) ? '🔒 ' : '') + t('channelPrefix') + state.context.id;
    if (mb) mb.hidden = false;
  }
  updateMemberBadge();
}

/* ---------- 侧边栏渲染 ---------- */
function renderChannelList() {
  const ul = $('channelList'); ul.innerHTML = '';
  const list = state.channels;
  // 频道列表面板独立可折叠，这里直接展示全部频道（不再前5截断）
  for (const name of list) {
    const li = document.createElement('li');
    if (state.context.type === 'channel' && state.context.id === name) li.className = 'active';
    const canDel = name !== 'global';   // 默认频道 global 不可删
    const lock = (name !== 'global' && channelIsPrivate(name)) ? '🔒 ' : '';
    li.innerHTML = `<span class="nm">${lock}# ${name}</span>` + (canDel ? `<span class="del" title="${t('delChannel')}">✕</span>` : '');
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del')) { deleteChannel(name); }
      else { switchToChannel(name); }
    });
    ul.appendChild(li);
  }
  const box = $('chanMoreBox'); if (box) box.innerHTML = '';
}
// 删除频道：从列表移除（保护默认频道 global）并清理其本地消息
async function deleteChannel(name) {
  if (name === 'global') return;
  if (!confirm(t('delChannelConfirm', name))) return;
  state.channels = state.channels.filter(c => c !== name);
  await saveChannels();
  if (state.context.type === 'channel' && state.context.id === name) {
    switchToChannel(state.channels[0] || 'global');   // 内部已重渲染列表
  } else {
    renderChannelList();
  }
  // 清理该频道下所有本地消息（仅本机，不影响同步对端）
  const all = await idbGetAll('messages');
  for (const m of all) if (m.ctx === name) await idbDelete('messages', m.id);
}
function renderFriendList() {
  const ul = $('friendList'); ul.innerHTML = '';
  const list = [...state.friends.values()];
  const expanded = state.listExpanded.friends;
  let shown = expanded ? list : list.slice(0, 5);
  // 折叠态下，确保当前私聊对象始终可见（替换末位）
  if (!expanded && state.context.type === 'dm' && state.context.peer && !shown.includes(state.context.peer) && list.includes(state.context.peer)) {
    shown = shown.slice(0, 4).concat(state.context.peer);
  }
  for (const f of shown) {
    const li = document.createElement('li');
    const active = state.context.type === 'dm' && state.context.peer && state.context.peer.address === f.address;
    if (active) li.className = 'active';
    li.innerHTML = `<span><span class="nm">${f.nickname || shortAddr(f.address)}</span><br><span class="sub">${shortAddr(f.address)}</span></span><span class="del" title="${t('delFriend')}">✕</span>`;
    li.addEventListener('click', (e) => { if (e.target.classList.contains('del')) { removeFriend(f.address); } else { switchToDM(f); } });
    ul.appendChild(li);
  }
  renderListMore('friendMoreBox', 'friends', list.length);
}

// 列表「显示前5 / 全部」切换按钮（仅当条目 >5 时显示）
function renderListMore(boxId, key, total) {
  const box = $(boxId);
  if (!box) return;
  box.innerHTML = '';
  if (total <= 5) return;
  const btn = document.createElement('button');
  btn.className = 'list-more';
  btn.textContent = state.listExpanded[key] ? t('collapseList') : t('showAll', total);
  btn.addEventListener('click', () => {
    state.listExpanded[key] = !state.listExpanded[key];
    if (key === 'channels') renderChannelList(); else renderFriendList();
  });
  box.appendChild(btn);
}

// 面板折叠 / 展开（频道、好友）
function togglePanel(panelId, key) {
  state.panelCollapsed[key] = !state.panelCollapsed[key];
  const p = $(panelId);
  if (state.panelCollapsed[key]) p.classList.add('collapsed'); else p.classList.remove('collapsed');
}

// 公钥改为「点击查看」→ 弹窗展示，不再直接显示明文
function renderMyPub() {
  const el = $('pubContent');
  if (el) el.textContent = state.address ? myPubCard() : '—';
}

/* ---------- 可选：GunDB 去中心化同步 ---------- */
let gun = null;
let appEl = null;           // 移动端抽屉控制
function closeNav() { if (appEl) appEl.classList.remove('nav-open'); }
// 顶栏连接状态点：off(灰)/down(橙=连接中·断开)/live(绿=已连)
function setConn(cls, title) {
  const d = $('connDot'); if (!d) return;
  d.className = 'conn-dot ' + (cls || '');
  d.title = title || '';
}
function connectGun() {
  if (typeof Gun === 'undefined') { $('syncHint').textContent = t('noGun'); setConn('off', t('noGun')); return false; }
  const url = (state.relayUrl || RELAY_URL).trim();
  gun = Gun({ peers: [url], localStorage: false, radisk: false });
  // 真实连接状态指示：连上中继 → ✅，断开 → ⚠️
  try {
  gun.on('hi', () => { if (state.syncOn) { $('syncHint').textContent = t('syncLive'); setConn('live', t('syncLive')); } });
  gun.on('bye', () => { if (state.syncOn) { $('syncHint').textContent = t('syncDown'); setConn('down', t('syncDown')); } });
  } catch (e) { /* 某些 Gun 版本不支持 mesh 事件，忽略 */ }
  gun.get('web3chat').map().on((data) => {
    if (!data || !data.id || !data.sig) return;
    if (data.ctx !== state.context.id) return; // 仅摄取当前上下文
    // 频道附件以 fileJson（顶层字符串）同步，这里还原成对象；避免 Gun 把嵌套 file 变成图引用 → 接收端显示 file(0B)
    if (data.fileJson && !data.file) {
      try { data.file = JSON.parse(data.fileJson); } catch (e) { data.file = null; }
    }
    // 旧数据若仍是 Gun 图引用（{ '#': ... }），不要用它覆盖本地好记录
    if (data.file && typeof data.file === 'object' && data.file['#']) return;
    if (seen.has(data.id)) return;
    saveMessage(data).then(renderMessages);
  });
  watchMeta();   // 启动私有频道元数据监听
  return true;
}
// 仅更新文案（切换语言时复用），不重连
function setModeText() {
  const badge = $('modeBadge'), hint = $('syncHint');
  if (!badge || !hint) return;
  if (state.syncOn) {
    badge.textContent = t('modeDecentral');
    hint.textContent = t('syncHintOn');
    setConn('down', t('syncDown'));
  } else {
    badge.textContent = t('modeLocal');
    hint.textContent = t('syncHintOff');
    setConn('off', t('modeLocal'));
  }
}
function setMode() {
  if (state.syncOn) {
    $('modeBadge').textContent = t('modeDecentral');
    setConn('down', t('connecting'));
    const ok = connectGun();
    if (ok) $('syncHint').textContent = t('syncHintOn');
  } else {
    setModeText();
  }
}

/* =====================================================================
 * 路线 B：加密成员制（私有频道）
 * - 全局频道 global 保持全开放；勾选「私有」创建的频道为加密成员制。
 * - 创建者生成频道密钥 K（AES-GCM 256），用 ECDH 单发 K 给被批准成员。
 * - 未持 K 者能收到密文但解不开（真不可见）。
 * - 踢人 → 换密钥 K'，仅剩员收到 K'，被踢者失新消息权（历史保留）。
 * - 元数据（kind/creator/members/approvers/membersDh）明文存于网络；K 绝不广播。
 * ===================================================================== */
// 读取某频道元数据（带 2.5s 超时兜底）
async function getChannelMeta(name) {
  return new Promise((resolve) => {
    if (!gun) return resolve(null);
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => finish(null), 2500);
    gun.get('web3chat').get('chanmeta').get(name).once((data) => {
      if (data && data.kind) finish(data); else finish(null);
    });
  });
}
const watchedChannels = new Set();
// 对某个私有频道建立「我的密钥分发 / 入群申请」监听（幂等）
function watchChannel(name) {
  if (!gun || watchedChannels.has(name)) return;
  watchedChannels.add(name);
  // 我被批准时，审批人把 K 发到 keys/<我的地址>
  gun.get('web3chat').get('chanmeta').get(name).get('keys').get(state.address).on((data) => {
    if (data && data.encKey) receiveChannelKey(name, data);
  });
  // 入群申请（供审批人查看并批准）
  gun.get('web3chat').get('chanmeta').get(name).get('requests').map().on((data, addr) => {
    if (!state.channelRequests[name]) state.channelRequests[name] = {};
    if (data && data.encFrom) { state.channelRequests[name][addr] = data; if (data.nick) state.addrNick[addr] = data.nick; }
    else if (state.channelRequests[name]) delete state.channelRequests[name][addr];
    if (name === state.context.id) { renderMemberPanel(); updateMemberBadge(); }
  });
}
// 收到审批人发来的 K（ECDH 共享密钥解密）
async function receiveChannelKey(name, data) {
  const incomingVer = data.keyVersion || 1;
  const cur = state.channelKeys[name];
  if (cur && (cur.version || 1) >= incomingVer) return;   // 已有更新或同版，跳过（防止换密钥时旧 K 覆盖新 K'）
  try {
    const shared = await deriveAES(state.dhPriv, data.byDh);
    const { iv, cipher } = JSON.parse(data.encKey);
    const rawB64 = await decryptText(shared, iv, cipher);
    const key = await importChannelKeyRaw(rawB64);
    state.channelKeys[name] = { key, version: incomingVer };
    await saveChannelKeys();
    renderMessages(); renderChannelList();
    if (name === state.context.id) { renderMemberPanel(); updateMemberBadge(); }
  } catch (e) { /* 解密失败（可能并非发给我），忽略 */ }
}
// 发送入群申请（含我的 ECDH 公钥，供审批人回发 K）
function sendJoinRequest(name) {
  if (!gun) return;
  const req = { encFrom: state.dhPubB64, ts: Date.now(), nick: state.nickname || '' };
  gun.get('web3chat').get('chanmeta').get(name).get('requests').get(state.address).put(req);
  if (!state.channelRequests[name]) state.channelRequests[name] = {};
  state.channelRequests[name][state.address] = req;
  if (name === state.context.id) renderMemberPanel();
}
// 审批人批准：用 ECDH 把 K 加密后单发给申请人，并把其加入 members/approvers/membersDh
async function approveRequest(name, addr, dh) {
  const k = state.channelKeys[name];
  if (!k) return;
  const shared = await deriveAES(state.dhPriv, dh);
  const rawB64 = await exportChannelKeyRaw(k.key);
  const { iv, cipher } = await encryptText(shared, rawB64);
  gun.get('web3chat').get('chanmeta').get(name).get('keys').get(addr).put({ encKey: JSON.stringify({ iv, cipher }), by: state.address, byDh: state.dhPubB64, keyVersion: k.version || 1 });
  // 子节点单键写入：让 Gun 正确合并、所有监听者即时更新（避免整体 put 覆盖丢成员）
  const base = gun.get('web3chat').get('chanmeta').get(name);
  base.get('members').get(addr).put(true);
  base.get('approvers').get(addr).put(true);
  base.get('membersDh').get(addr).put(dh);
  const meta = state.channelMeta[name] || {};
  meta.members = meta.members || {}; meta.members[addr] = true;
  meta.approvers = meta.approvers || {}; meta.approvers[addr] = true;
  meta.membersDh = meta.membersDh || {}; meta.membersDh[addr] = dh;
  state.channelMeta[name] = meta; await saveChannelMeta();
  gun.get('web3chat').get('chanmeta').get(name).get('requests').get(addr).put(null);   // 清除该申请
  if (state.channelRequests[name]) delete state.channelRequests[name][addr];
  if (name === state.context.id) { renderMemberPanel(); updateMemberBadge(); }
}
// 踢人（仅创建者）：换密钥 K' → 重发给剩员 → 被踢者失权
async function kickMember(name, addr) {
  const meta = state.channelMeta[name];
  if (!meta || state.address !== meta.creator) { alert(t('onlyCreatorKick')); return; }
  if (!confirm(t('kickConfirm', shortAddr(addr)))) return;
  const k = state.channelKeys[name];
  if (!k) return;
  const newKey = await generateChannelKey();
  const newVersion = (k.version || 1) + 1;
  const members = Object.assign({}, meta.members || {});
  const approvers = Object.assign({}, meta.approvers || {});
  const membersDh = Object.assign({}, meta.membersDh || {});
  const base = gun.get('web3chat').get('chanmeta').get(name);
  base.get('keyVersion').put(newVersion);
  base.get('members').get(addr).put(null);
  base.get('approvers').get(addr).put(null);
  base.get('membersDh').get(addr).put(null);
  delete members[addr]; delete approvers[addr]; delete membersDh[addr];
  const m = state.channelMeta[name] || {};
  m.members = members; m.approvers = approvers; m.membersDh = membersDh; m.keyVersion = newVersion;
  state.channelMeta[name] = m; await saveChannelMeta();
  // 把 K' 重发给剩余成员
  for (const a of Object.keys(members)) {
    if (a === state.address) continue;
    const dh = membersDh[a]; if (!dh) continue;
    const shared = await deriveAES(state.dhPriv, dh);
    const rawB64 = await exportChannelKeyRaw(newKey);
    const { iv, cipher } = await encryptText(shared, rawB64);
    gun.get('web3chat').get('chanmeta').get(name).get('keys').get(a).put({ encKey: JSON.stringify({ iv, cipher }), by: state.address, byDh: state.dhPubB64, keyVersion: newVersion });
  }
  gun.get('web3chat').get('chanmeta').get(name).get('keys').get(addr).put(null);   // 废除被踢者密钥
  state.channelKeys[name] = { key: newKey, version: newVersion };   // 本机也升到 K'
  await saveChannelKeys();
  if (name === state.context.id) renderMemberPanel();
  renderChannelList();
}
const watchedMeta = new Set();
// 对单个频道订阅「元数据子节点」（members/approvers/membersDh）——
// 用 .map().on() 逐键投递，规避「父节点 .on 把 members 当成 soul 引用而非展开对象」导致成员列表为空/乱码的坑。
function watchChannelMeta(name) {
  if (!gun || watchedMeta.has(name)) return;
  watchedMeta.add(name);
  const root = gun.get('web3chat').get('chanmeta').get(name);
  root.on((data) => {
    if (!data) return;
    const m = state.channelMeta[name] || {};
    m.kind = data.kind; m.creator = data.creator; m.keyVersion = data.keyVersion;
    state.channelMeta[name] = m; saveChannelMeta();
    renderChannelList();
    if (name === state.context.id) renderMemberPanel();
  });
  const sub = (field, bag) => {
    root.get(field).map().on((val, addr) => {
      if (!addr) return;
      const m = state.channelMeta[name] || {};
      m[bag] = m[bag] || {};
      if (val === null || val === undefined) delete m[bag][addr];
      else m[bag][addr] = (bag === 'membersDh') ? val : true;
      state.channelMeta[name] = m; saveChannelMeta();
      if (name === state.context.id) renderMemberPanel();
    });
  };
  sub('members', 'members');
  sub('approvers', 'approvers');
  sub('membersDh', 'membersDh');
}
// 全局元数据监听：发现频道即建立子节点监听（members 等逐键投递，可靠）
function watchMeta() {
  if (!gun) return;
  gun.get('web3chat').get('chanmeta').map().on((data, name) => {
    if (!data || !name) return;
    if (!state.channelMeta[name]) state.channelMeta[name] = {};
    state.channelMeta[name].kind = data.kind;
    state.channelMeta[name].creator = data.creator;
    state.channelMeta[name].keyVersion = data.keyVersion;
    saveChannelMeta();
    renderChannelList();
    watchChannelMeta(name);
    if (state.channels.includes(name)) watchChannel(name);
    if (name === state.context.id) renderMemberPanel();
  });
}
// 成员面板（模态框内容）
function updateMemberBadge() {
  const badge = $('memberBadge'); if (!badge) return;
  const name = state.context.id;
  let cnt = 0;
  if (state.context.type === 'channel' && channelIsPrivate(name) && haveChannelKey(name) && state.channelRequests[name]) {
    cnt = Object.entries(state.channelRequests[name]).filter(([a, d]) => d && d.encFrom && a !== state.address).length;
  }
  if (cnt > 0) { badge.textContent = '● ' + t('newReq', cnt); badge.hidden = false; badge.title = t('newReq', cnt); }
  else badge.hidden = true;
}

function renderMemberPanel() {
  const modal = $('memberModal'); if (!modal || modal.hidden) return;
  const body = $('memberBody'); if (!body) return;
  const name = state.context.id;
  const title = $('memberTitle'); if (title) title.textContent = (channelIsPrivate(name) ? '🔒 ' : '') + t('channelPrefix') + name;
  body.innerHTML = '';
  if (!channelIsPrivate(name)) {
    const info = document.createElement('div'); info.className = 'hint'; info.textContent = t('openChannelHint'); body.appendChild(info);
    return;
  }
  if (!haveChannelKey(name)) {
    const info = document.createElement('div'); info.className = 'hint'; info.textContent = t('privateHint'); body.appendChild(info);
    const req = document.createElement('button'); req.className = 'btn primary sm'; req.textContent = t('applyJoin');
    req.addEventListener('click', () => { sendJoinRequest(name); alert(t('joinRequested')); });
    body.appendChild(req);
    return;
  }
  const meta = state.channelMeta[name];
  if (meta && meta.members) {
    const order = Object.keys(meta.members).filter(a => a !== '#' && meta.members[a] === true);
    const head = document.createElement('div'); head.className = 'list-head'; head.textContent = t('memberList', order.length); body.appendChild(head);
    const ul = document.createElement('ul'); ul.className = 'list';
    const main = (meta.creator && meta.members[meta.creator]) ? meta.creator : (order[0] || '');
    for (const addr of order) {
      const li = document.createElement('li');
      const isMe = addr === state.address;
      const role = (addr === meta.creator) ? t('roleCreator') : (meta.approvers && meta.approvers[addr] ? t('roleApprover') : '');
      const star = (addr === main) ? '⭐ ' : '';
      li.innerHTML = `<span class="nm">${star}${nickOf(addr)}</span>`;
      if (role) { const r = document.createElement('span'); r.className = 'sub'; r.textContent = role; li.appendChild(r); }
      if (meta.creator === state.address && addr !== state.address) {
        const k = document.createElement('span'); k.className = 'del'; k.textContent = t('kick'); k.title = t('kick');
        k.addEventListener('click', () => kickMember(name, addr));
        li.appendChild(k);
      }
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }
  // 待批准申请（持 K 的审批人可见）
  if (haveChannelKey(name) && state.channelRequests[name]) {
    const reqs = Object.entries(state.channelRequests[name]).filter(([a, d]) => d && d.encFrom && a !== state.address);
    if (reqs.length) {
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = t('pendingReq'); body.appendChild(h);
      const ul = document.createElement('ul'); ul.className = 'list';
      for (const [addr, d] of reqs) {
        const li = document.createElement('li'); li.innerHTML = `<span class="nm">${nickOf(addr)}</span>`;
        const btn = document.createElement('button'); btn.className = 'btn primary sm'; btn.textContent = t('approve');
        btn.addEventListener('click', () => approveRequest(name, addr, d.encFrom));
        li.appendChild(btn); ul.appendChild(li);
      }
      body.appendChild(ul);
    } else {
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = t('noPending'); body.appendChild(h);
    }
  }
}
function openMemberModal() { const m = $('memberModal'); if (m) { m.hidden = false; renderMemberPanel(); } }
function closeMemberModal() { const m = $('memberModal'); if (m) m.hidden = true; }
// 取某地址的展示昵称：自己→本机昵称；他人→消息/申请里收集到的昵称，缺省回退短地址
function nickOf(addr) {
  if (addr === state.address) return state.nickname || shortAddr(addr);
  return (state.addrNick && state.addrNick[addr]) || shortAddr(addr);
}

/* ---------- 表情 / 表情包选择器 ---------- */
// Blob -> dataURL（用于把贴图图片转 base64 作为附件发送）
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}

/* ---------- 图片自动压缩（A 方案：发送前压到上限内） ---------- */
// 图片附件发送前先压缩：降采样到 maxEdge，再迭代降 JPEG 质量逼近 < MAX_ATTACH_BYTES。
// 铺白底以兼容透明 PNG（JPEG 无透明通道）。返回 {dataURL,size,type,name}。
async function compressImage(file, maxEdge = 1600) {
  const img = await new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('imgLoad')); };
    im.src = u;
  });
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);   // 白底，兼容透明图转 JPEG
  ctx.drawImage(img, 0, 0, w, h);
  let q = 0.85;
  let dataURL = canvas.toDataURL('image/jpeg', q);
  // dataURL 长度 × 3/4 ≈ 字节数；迭代降质量，直到压到上限内（或质量触底）
  while (dataURL.length > MAX_ATTACH_BYTES * 4 / 3 && q > 0.4) {
    q -= 0.1;
    dataURL = canvas.toDataURL('image/jpeg', q);
  }
  const size = Math.floor(dataURL.length * 3 / 4);
  const name = file.name.replace(/\.(png|webp|gif|bmp)$/i, '.jpg').replace(/\.(jpe?g)$/i, '.jpg');
  return { dataURL, size, type: 'image/jpeg', name };
}

/* ---------- 通用提示弹窗 ---------- */
function showAlert(titleText, bodyText) {
  $('alertTitle').textContent = titleText;
  $('alertBody').textContent = bodyText;
  $('alertModal').hidden = false;
}

function openEmojiPanel() {
  const p = $('emojiPanel'); if (!p) return;
  p.classList.add('open');
  // 重置到「表情」标签并刷新两个网格的显隐（用 class/内联样式，避免 hidden 属性被 display:flex/grid 覆盖的坑）
  document.querySelectorAll('#emojiPanel .emoji-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'emoji'));
  $('emojiGrid').style.display = 'grid';
  $('stickerGrid').style.display = 'none';
  renderEmojiGrid();
}
function closeEmojiPanel() { const p = $('emojiPanel'); if (p) p.classList.remove('open'); }
function toggleEmojiPanel() { const p = $('emojiPanel'); if (!p) return; if (p.classList.contains('open')) closeEmojiPanel(); else openEmojiPanel(); }

function renderEmojiGrid() {
  const g = $('emojiGrid'); if (!g || g.childElementCount) return;   // 只构建一次
  for (const ch of EMOJI_LIST) {
    const b = document.createElement('button');
    b.className = 'emoji-cell'; b.type = 'button'; b.textContent = ch; b.title = ch;
    b.addEventListener('click', () => insertEmoji(ch));
    g.appendChild(b);
  }
}
function renderStickerGrid() {
  const g = $('stickerGrid'); if (!g || g.childElementCount) return;
  for (const [ch, code] of STICKER_LIST) {
    const b = document.createElement('button');
    b.className = 'emoji-cell sticker-cell'; b.type = 'button'; b.title = ch;
    const img = document.createElement('img'); img.alt = ch; img.loading = 'lazy';
    img.src = TWEMOJI_BASE + code + '.png';
    // 离线 / 加载失败 → 退化为文字 emoji（仍可发送）
    img.onerror = () => { const s = document.createElement('span'); s.className = 'emoji-fallback'; s.textContent = ch; if (img.parentNode) img.parentNode.replaceChild(s, img); };
    b.appendChild(img);
    b.addEventListener('click', () => pickSticker(ch, code));
    g.appendChild(b);
  }
}
// 把表情插入输入框光标处（可连续插入，面板保持打开）
function insertEmoji(ch) {
  const inp = $('msgInput'); if (!inp) return;
  const s = (inp.selectionStart != null) ? inp.selectionStart : inp.value.length;
  const e = (inp.selectionEnd != null) ? inp.selectionEnd : inp.value.length;
  inp.value = inp.value.slice(0, s) + ch + inp.value.slice(e);
  const pos = s + ch.length; inp.setSelectionRange(pos, pos); inp.focus();
}
// 选贴图：拉取公开 Twemoji PNG → 转 base64 → 作为待发图片附件（走既有加密/同步管线）
async function pickSticker(ch, code) {
  let dataURL = null, size = 0;
  if (stickerCache.has(code)) { dataURL = stickerCache.get(code); size = Math.round((dataURL.split(',')[1] || '').length * 3 / 4); }
  else {
    try {
      const r = await fetch(TWEMOJI_BASE + code + '.png');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob(); size = blob.size; dataURL = await blobToDataURL(blob);
      stickerCache.set(code, dataURL);
    } catch (err) { /* 离线：退化为文字表情 */ }
  }
  if (dataURL) {
    state.pendingFile = { name: 'sticker_' + code + '.png', type: 'image/png', size, data: dataURL };
    renderAttachPreview();
  } else {
    insertEmoji(ch); alert(t('stickerFail'));
  }
  closeEmojiPanel();
}

/* ---------- 事件绑定 ---------- */
function bindUI() {
  appEl = document.querySelector('.app');
  $('navToggle').addEventListener('click', () => appEl.classList.toggle('nav-open'));
  $('overlay').addEventListener('click', () => appEl.classList.remove('nav-open'));
  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $('howToBtn').addEventListener('click', () => { window.open('howto.html', '_blank'); });
  $('sendBtn').addEventListener('click', sendMessage);
  $('msgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

  // 表情 / 表情包选择器
  $('emojiBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleEmojiPanel(); });
  document.querySelectorAll('#emojiPanel .emoji-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#emojiPanel .emoji-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isEmoji = tab.dataset.tab === 'emoji';
      $('emojiGrid').style.display = isEmoji ? 'grid' : 'none';
      $('stickerGrid').style.display = isEmoji ? 'none' : 'grid';
      if (!isEmoji) renderStickerGrid(); else renderEmojiGrid();
    });
  });
  // 点击面板外部 / 按 Esc 关闭
  document.addEventListener('click', (e) => {
    const p = $('emojiPanel'); if (!p || !p.classList.contains('open')) return;
    if (!p.contains(e.target) && e.target.id !== 'emojiBtn') closeEmojiPanel();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEmojiPanel(); });

  // 附件：选文件 → 图片先自动压缩 → 超限弹窗提示（不再用原生 alert）
  $('attachBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';   // 提前清空，避免压缩 await 期间值残留
    if (!f) return;
    // 图片：先自动压缩到上限内
    if (f.type && f.type.indexOf('image/') === 0) {
      try {
        const c = await compressImage(f);
        if (c.size > MAX_ATTACH_BYTES) { showAlert(t('fileTooBigTitle'), t('fileTooBig')); return; }
        state.pendingFile = { name: c.name, type: c.type, size: c.size, data: c.dataURL };
        renderAttachPreview();
        return;
      } catch (_) { /* 压缩失败，退回原图路径 */ }
    }
    // 非图片 / 压缩失败：原图受上限约束
    if (f.size > MAX_ATTACH_BYTES) { showAlert(t('fileTooBigTitle'), t('fileTooBig')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      state.pendingFile = { name: f.name, type: f.type || 'application/octet-stream', size: f.size, data: reader.result };
      renderAttachPreview();
    };
    reader.readAsDataURL(f);
  });

  $('syncToggle').checked = state.syncOn;
  $('syncToggle').addEventListener('change', (e) => { state.syncOn = e.target.checked; saveSync(); setMode(); });

  // 中继地址：默认隐藏具体网址，仅显示「修改中继地址」按钮；点按钮才弹出输入框
  $('relayInput').value = state.relayUrl || RELAY_URL;   // 值仍存于隐藏 input，供编辑时读取
  $('relayEditBtn').addEventListener('click', () => {
    $('relayInput').value = state.relayUrl || RELAY_URL;
    $('relayEditBox').classList.add('open');   // 点修改才弹出（用 class 控制显隐，避免 .row 的 display:flex 覆盖 hidden 属性）
    $('relayInput').focus();
  });
  $('relayCancelBtn').addEventListener('click', () => {
    $('relayEditBox').classList.remove('open');   // 取消：隐藏编辑框，不改地址
  });
  $('relaySaveBtn').addEventListener('click', () => {
    const v = $('relayInput').value.trim(); if (!v) return;
    state.relayUrl = v; saveRelay();
    $('relayEditBox').classList.remove('open');
    $('syncHint').textContent = t('relaySaved');
    if (state.syncOn) { gun = null; setMode(); }   // 开着同步则立即重连到新地址
  });
  // 昵称：可随时修改，存本机身份并即时刷新显示
  $('nickInput').value = state.nickname || '';
  $('nickInput').addEventListener('change', async (e) => {
    state.nickname = (e.target.value.trim() || '');
    await saveNickname();
    $('addrLabel').textContent = state.nickname || shortAddr(state.address);
    renderMessages();   // 让已有消息立即用新昵称显示
  });

  // 查 Gun 中继上是否已有同名频道（别人发过该 ctx 的公开消息）。用于新建频道查重，避免重名。带 2.5s 超时兜底（中继冷启动/慢则默认允许新建，不卡用户）。
  async function channelExistsOnNetwork(name) {
    return new Promise((resolve) => {
      if (!gun) return resolve(false);
      let done = false;
      const finish = (val) => { if (done) return; done = true; clearTimeout(timer); resolve(val); };
      const timer = setTimeout(() => finish(false), 2500);
      gun.get('web3chat').map().once((data) => {
        if (data && data.ctx === name && data.address && data.address !== state.address) finish(true);
      });
    });
  }

  $('joinChannelBtn').addEventListener('click', async () => {
    const v = $('newChannel').value.trim(); if (!v) return;
    $('newChannel').value = '';
    const priv = $('privateChk') && $('privateChk').checked;
    // 1) 本机查重：已存在 → 直接切换
    if (state.channels.includes(v)) { switchToChannel(v); if ($('privateChk')) $('privateChk').checked = false; return; }
    // 2) 全网查重（仅同步时）：读元数据判断 open / private
    if (state.syncOn && gun) {
      const btn = $('joinChannelBtn'); const oldTxt = btn.textContent;
      btn.disabled = true; btn.textContent = '…';
      let meta = null; try { meta = await getChannelMeta(v); } catch (e) { meta = null; }
      let exists = false; try { exists = await channelExistsOnNetwork(v); } catch (e) { exists = false; }
      btn.disabled = false; btn.textContent = oldTxt;
      if (meta && meta.kind === 'private') {
        // 既有私有频道 → 申请加入（不能重复创建）
        if (!state.channels.includes(v)) { state.channels.push(v); saveChannels(); renderChannelList(); }
        switchToChannel(v); watchChannel(v); sendJoinRequest(v);
        alert(t('joinRequested'));
        if ($('privateChk')) $('privateChk').checked = false;
        return;
      }
      if (meta && meta.kind === 'open') {
        // 既有开放频道 → 按开放加入（忽略私有勾选）
        if (!state.channels.includes(v)) { state.channels.push(v); saveChannels(); renderChannelList(); }
        switchToChannel(v);
        if ($('privateChk')) $('privateChk').checked = false;
        return;
      }
      if (exists) {
        if (!state.channels.includes(v)) { state.channels.push(v); saveChannels(); renderChannelList(); }
        switchToChannel(v); alert(t('channelDup', v));
        if ($('privateChk')) $('privateChk').checked = false;
        return;
      }
    }
    // 3) 真正新建
    if (priv) {
      // 创建私有频道：本机生成 K，写元数据（创建者=我）
      const k = await generateChannelKey();
      state.channelKeys[v] = { key: k, version: 1 };
      await saveChannelKeys();
      const m = { kind: 'private', creator: state.address, keyVersion: 1, members: { [state.address]: true }, approvers: { [state.address]: true }, membersDh: { [state.address]: state.dhPubB64 } };
      if (gun) {
        const base = gun.get('web3chat').get('chanmeta').get(v);
        base.get('kind').put('private');
        base.get('creator').put(state.address);
        base.get('keyVersion').put(1);
        base.get('members').get(state.address).put(true);
        base.get('approvers').get(state.address).put(true);
        base.get('membersDh').get(state.address).put(state.dhPubB64);
        watchChannel(v); watchChannelMeta(v);
      }
      state.channelMeta[v] = m;
      await saveChannelMeta();
    }
    state.channels.push(v); saveChannels(); renderChannelList(); switchToChannel(v);
    if ($('privateChk')) $('privateChk').checked = false;
  });

  // 手动添加好友：粘贴对方的「公钥卡片」(JSON)
  $('addFriendBtn').addEventListener('click', async () => {
    const card = prompt(t('pasteCard'));
    if (!card) return;
    try {
      const o = JSON.parse(card.trim());
      if (!o.addr) throw new Error('missing addr');
      const addr = await deriveAddress(base64ToBuf(o.sign)); // 用签名公钥推导地址，保证一致
      addFriendRaw(addr, o.sign, o.dh, o.addr);
      alert(t('friendAdded') + shortAddr(addr));
    } catch (err) { alert(t('addFailed') + err.message); }
  });

  // 频道 / 好友 面板折叠开关
  $('chanCollapse').addEventListener('click', () => togglePanel('chanListPanel', 'channels'));
  $('friendCollapse').addEventListener('click', () => togglePanel('friendPanel', 'friends'));

  // 「查看公钥」：点击弹窗展示完整公钥卡片，并支持复制
  $('viewPubBtn').addEventListener('click', () => {
    renderMyPub();
    $('pubModal').hidden = false;
  });
  const closePub = () => { $('pubModal').hidden = true; };
  $('pubClose').addEventListener('click', closePub);
  $('pubMask').addEventListener('click', closePub);
  // 通用提示弹窗关闭
  const closeAlert = () => { $('alertModal').hidden = true; };
  $('alertClose').addEventListener('click', closeAlert);
  $('alertMask').addEventListener('click', closeAlert);
  $('alertOk').addEventListener('click', closeAlert);
  $('pubCopyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(myPubCard()).then(() => alert(t('copied')));
  });

  $('exportBtn').addEventListener('click', async () => {
    if (!confirm(t('exportIdWarn'))) return;   // ⚠️ 含私钥，二次确认防误发
    const blob = new Blob([await exportIdentity()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'web3-identity.json'; a.click();
    URL.revokeObjectURL(a.href);
  });
  // 聊天记录备份：导出 / 导入
  $('exportMsgBtn').addEventListener('click', exportMessages);
  $('importMsgBtn').addEventListener('click', () => $('importMsgFile').click());
  $('importMsgFile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; await importMessages(f); e.target.value = ''; });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importIdentity(await file.text()); renderMyPub(); renderCtxHeader(); await renderMessages(); alert(t('importOk')); }
    catch (err) { alert(t('importFail') + t(err.message)); }
    e.target.value = '';
  });
  $('logoutBtn').addEventListener('click', async () => {
    if (!confirm(t('logoutConfirm'))) return;
    await idbClear('identity'); await idbClear('messages'); await idbClear('friends'); await idbClear('meta');
    seen.clear(); location.reload();
  });

  // 路线 B：成员面板（👥 按钮 + 模态框关闭）
  $('memberBtn').addEventListener('click', openMemberModal);
  $('memberClose').addEventListener('click', closeMemberModal);
  $('memberMask').addEventListener('click', closeMemberModal);

  // 欢迎页：点击「开始使用」隐藏首屏，露出主应用
  $('enterBtn').addEventListener('click', () => { $('welcome').hidden = true; });
}

/* ---------- 启动 ---------- */
(async function init() {
  await openDB();
  await loadIdentity();
  await loadMeta();
  renderMyPub();
  await loadFriends();
  if (!state.channels.includes(state.context.id) && state.context.type === 'channel') state.context = { type: 'channel', id: 'global', peer: null };
  if (state.context.type === 'dm' && (!state.context.peer || !state.friends.has(state.context.peer.address))) {
    state.context = { type: 'channel', id: state.channels[0] || 'global', peer: null };
  }
  $('addrLabel').textContent = state.nickname || shortAddr(state.address);
  $('addrLabel').title = state.address;   // 悬停看完整地址
  bindUI();
  applyI18n();
  renderChannelList(); renderFriendList(); renderCtxHeader();
  await renderMessages();
  if (state.syncOn) setMode();
})().catch((err) => {
  console.error(err);
  alert(t('initFail') + err.message + t('initFailTip'));
});
