# Web3 Local Chat · User Guide

This guide is for **end users** (not deployers). You don't need to understand blockchain, install a wallet, or create an account — just open the page and chat.

> Use case: you want to chat privately with friends without storing records on any company's server. This app keeps chat history **only in your own browser**, and optionally lets you and your friends exchange messages via "decentralized sync".
>
> Three languages: the UI supports **中文 / English / Deutsch**. On first open it **auto-detects your system language**; you can also switch manually at any time.

---

## 1. How to open

The chat app is a web page and must be opened from a "networked web address" (`localhost` or `https`). **Double-clicking `index.html` directly (`file://`) may break the encryption features in some browsers** — please use one of the methods below:

| Method | Steps |
|---|---|
| Local on your machine | In the folder run `python -m http.server 8080`, then open `http://localhost:8080/` in your browser |
| A deployed URL | Just click the link (e.g. the `https://...` address from GitHub Pages / Render) |

When opened, you **don't log in and don't need a password** — your identity is generated automatically (see Section 2).

---

## 2. Your identity (auto-generated)

- On first open, the page **automatically generates a local identity** (two keys) in your browser, and shows a `0x…` address — this is your "Web3 account".
- This identity **exists only in your browser's local storage (IndexedDB)** and is never uploaded to any server.
- Refreshing or reopening keeps the same identity and same address.
- **Want to keep the same identity on another device / browser?** Click "**Export**" in the top bar to download a `web3-identity.json` file (contains your keys — keep it safe); on the new device/browser, open the page and click "**Import**" to select that file and restore the same address.

> ⚠️ Private keys are stored in plaintext in this browser. Anyone who can open your browser can read them. For sensitive scenarios, use "Export" to back up, then clear, or use a private/incognito window.

---

## 3. Layout

- **Desktop (PC)**: left side is the "Channels / Friends" panel, right side is the chat area; the top bar has language switch and identity actions.
- **Mobile**: only the chat area shows by default; tap the **☰** button at top-left to slide out the left panel, tap the blank area (overlay) or pick a channel to auto-collapse it.

---

## 4. Channel chat (public, verifiable)

1. In the left "Channels" input, type a channel name (e.g. `global`) and click "**Join**".
2. Everyone's messages in a channel are **public and digitally signed** — each message shows "✓ Verified", meaning it genuinely came from that address and wasn't tampered with.
3. As long as you and a friend **join the same channel name** and both have sync on (Section 6), you can see each other's messages.

> Channel messages are public — don't post private content there. Use direct messages for private content (Section 5).

---

## 5. Adding friends & direct messages (end-to-end encrypted)

### Two ways to add a friend

**Method A (easiest, requires being in the same channel first)**
1. You and the other person join the same channel, and they post at least one message there;
2. You click the "**＋ Friend**" button under their message — the system **automatically grabs both of their public keys**, and once added you can DM them.

**Method B (manually paste a "public-key card")**
1. Ask the other person to click "**Copy my public key**" in the top bar (it copies a JSON "public-key card") and send it to you;
2. You click "**＋ Friend**" on the left, paste that JSON in and confirm.

### Direct messages (🔒 E2EE)

- Click a person in the left friends list to enter a DM.
- DM content is **end-to-end encrypted**: only you and the other person can decrypt and read it; even the relay server only sees garbled ciphertext.
- The other person must **already have your encryption public key** to send you encrypted messages (i.e. you've added each other via A or B above, and they've posted in a channel or you added them via their card).

> If you see "recipient missing encryption key", just re-add them via A/B above.

---

## 6. Decentralized sync (lets messages cross devices / people)

By default your messages **stay only on your machine** and others can't reach you. To chat with friends, turn on sync and point to the same relay node:

1. Find the "**Decentralized sync**" switch in the top bar and turn it on;
2. In "**Relay address**" enter the relay URL you agreed on (e.g. your deployed `https://chat4-relay.onrender.com/gun`, or local `http://localhost:8765/gun`);
3. You and your friend enter **the same** relay address and join **the same** channel name to talk; after adding each other as friends you can DM.

> - Even with sync on, **chat history stays only in each person's own browser (IndexedDB)** — messages are just relayed to the other party.
> - If you want "not even my messages leave this machine", keep sync **off**.
> - Most free public relay nodes are dead; use a self-hosted / deployed relay address.

---

## 7. Language switch

- The top-right has "**中文 | EN | DE**" buttons; click to switch the UI language instantly.
- Your choice is remembered (next open keeps your selected language).
- **On first open** it auto-matches your OS/browser language: German system → German UI, English → English, otherwise defaults to English.

---

## 8. FAQ

**Q: Messages won't send / friend can't see me?**
A: Check that "Decentralized sync" is on, the relay address is correct and reachable; confirm you're using the exact same channel name. Pure-local mode (sync off) is single-user by design — nobody can see you.

**Q: DM shows "cannot decrypt"?**
A: Usually the public keys don't match. Re-add the person via "＋ Friend" (Method A is most reliable), making sure both sides have each other's encryption public key.

**Q: Can I use my identity on a new phone/computer?**
A: Yes. Use "Export" to back up `web3-identity.json`, then "Import" on the new device to restore the same address and friend relationships.

**Q: Will I lose my history?**
A: As long as you don't clear browser cache/local storage, don't switch devices without a backup, the history stays. For important conversations, export your identity as a backup.

**Q: Is this truly "decentralized"?**
A: Pure-local mode best fits "records stay only local". After enabling GunDB sync, messages are relayed across nodes via P2P — that's the real decentralized part. Both modes stay under your control.

---

---

## 9. Chat history backup (export / import)

The settings area now has two buttons: "**Export**" and "**Import**".

- **Export**: packs all your chat messages (plus the channel list) into a `web3chat-backup.json` file downloaded locally. Back up important conversations regularly.
- **Import**: pick a backup file; messages merge by id (no duplicates), and new channel names are added automatically. Use it to recover history after switching devices or clearing cache — only if you exported before.

> ⚠️ Chat-history backup and "Export identity" are **two different things**: identity backup saves your keys/address, history backup saves the messages. Save both.

---

## 10. Nickname & connection status

- **Nickname**: the "Nickname" box in settings lets you set a display name (max 20 chars). It's stored in your local identity and sent to peers with your messages, so they see this name. After switching devices, importing your identity keeps the nickname too.
- **Connection dot**: next to the "Local / Decentralized" badge in the top bar is a small dot — **gray = pure local**, **orange = connecting or relay dropped (auto-reconnecting)**, **green = connected to relay, live sync**. You can tell the sync state at a glance.

---

*To deploy this chat app yourself (so others can open it and talk with you), see `README.md` in the repo.*
