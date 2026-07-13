# Web3 Local Chat · User Guide

This guide is for **end users** (not deployers). You don't need to understand blockchain, install a wallet, or create an account — just open the page and chat.

> Use case: you want to chat privately with friends without storing records on any company's server. This app keeps chat history **only in your own browser**, and optionally lets you and your friends exchange messages via "decentralized sync".
>
> The UI supports **中文 / English**; on first open it **auto-detects your system language**; you can also switch manually at any time.

---

## 1. How to open

The chat app is a **web application** deployed at a networked URL. Just open the deployed address in any browser — **no install, no sign-up, no password**. Your identity is generated automatically on first open (see Section 2), and you can start chatting right away.

> It runs in your browser; all keys and chat history stay local (IndexedDB). Just remember the URL — open it on any device's browser and import your identity to get back to your account.

---

## 2. Your identity (auto-generated)

- On first open, the page **automatically generates a local identity** (two keys) in your browser, and shows a `0x…` address — this is your "Web3 account".
- This identity **exists only in your browser's local storage (IndexedDB)** and is never uploaded to any server.
- Refreshing or reopening keeps the same identity and same address.
- You can set a **nickname** in the Identity panel; it is sent with your messages and shown to others.
- **Want to keep the same identity on another device / browser?** In the Identity panel click "**Export Identity**" to download a `web3-identity.json` file (contains your keys — keep it safe); on the new device open the page and click "**Import Identity**" to select that file and restore the same address and friend relationships.

> 🔑 **What identity backup does**: it carries your "account (address) + two keys". After a device switch / loss, "**Import Identity**" on the new device **restores the same address and friend relationships**, and because the private keys are back, you can **keep sending/receiving messages and decrypt private channels & DMs**.
>
> **But note**: chat history itself lives only in the old device's browser (IndexedDB) — **the identity backup contains no chat content**. So — if the old device still works (a switch), also use "**Export**" (history) to carry the history along; on the new device do "Import Identity" + "Import" (history) to restore both your account and all conversations (see Section 7). If the device is already lost and you never exported history, the old conversations can't be recovered, but "Import Identity" at least lets you use the same account again and keep exchanging new messages.

> ⚠️ Private keys are stored in plaintext in this browser. Anyone who can open your browser can read them. For sensitive scenarios, use "Export Identity" to back up, then clear, or use a private/incognito window.

---

## 3. Layout

- **Desktop (PC)**: left side is the "Channels / Friends" panel, right side is the chat area; the top bar has language switch and identity actions.
- **Mobile**: only the chat area shows by default; tap the **☰** button at top-left to slide out the left panel, tap the blank area (overlay) or pick a channel to auto-collapse it.

---

## 4. Public channels (public, verifiable)

1. In the left "Channels" input, type a channel name (e.g. `global`) and click "**Join**".
2. Everyone's messages in a channel are **public and digitally signed** — each message shows "✓ Verified", meaning it genuinely came from that address and wasn't tampered with.
3. As long as you and a friend **join the same channel name** and both have sync on (Section 8), you can see each other's messages.
4. To remove a channel: in the left channel list, **every non-default channel has a `✕` delete button on its right**. Click it and confirm to **delete that channel and its local messages** (the default `global` channel is protected — not deletable, always kept).

> Channel messages are public — don't post private content there. Use direct messages (Section 6) or a private channel (Section 5) for private content.

---

## 5. Private channels (encrypted membership)

If you want to privately group-chat with **a specific set of people**, use a private channel. It's like an "encrypted group": messages are **end-to-end encrypted**, and only approved members who hold the channel key can decrypt them.

- **Create**: in the channel input, type a channel name, tick "**🔒 Private (encrypted membership)**", and click Join → you automatically become the **creator**, and the app generates a channel key `K`.
- **Encryption effect**: messages in the channel are encrypted with `K`; non-members see only ciphertext (prompted "🔒 encrypted message — join to view"), never the plaintext.
- **Invite friends**: friends also type the **same channel name** and tick 🔒 Private to join; they'll see ciphertext plus an "**Apply to join**" button. After they click it, you (the creator/approver) will see a "pending requests" entry in the channel's "**👥 Members**" panel — click "**Approve**" and the app **end-to-end encrypts and sends them the key K automatically**.
- **After approval**: they can read and post encrypted messages (before approval they can't post).
- **vs. direct messages**: a private channel is a **multi-person encrypted group**; a DM (Section 6) is just between two people.
- **Managing members**: the creator can "**kick**" someone — the app rotates the key `K` and re-distributes it to remaining members; the kicked person can no longer read new messages afterward (history is kept).

> The private channel key is distributed via end-to-end encryption, so even the relay server can't learn the plaintext. Great for small teams or private friend groups.

---

## 6. Adding friends & direct messages (end-to-end encrypted)

**Method A (easiest, requires being in the same channel first)**

1. You and the other person join the same channel, and they post at least one message there;
2. You click the "**＋ Friend**" button under their message — the system **automatically grabs both of their public keys**, and once added you can DM them.

**Method B (manually paste a "public-key card")**

1. Ask the other person to click "**Copy my public key**" in the Identity panel (it copies a JSON "public-key card") and send it to you;
2. You click "**＋ Friend**" on the left, paste that JSON in and confirm.

**Direct messages (🔒 E2EE)**: click a person in the left friends list to enter a DM. DM content is **end-to-end encrypted**: only you and the other person can decrypt and read it; even the relay server only sees garbled ciphertext. The other person must **already have your encryption public key** to send you encrypted messages.

> If you see "recipient missing encryption key", just re-add them via A/B above.

---

## 7. Chat-history backup: export / import

To keep conversations long-term or migrate them, you can back up your chat history. **Note: this is different from "Export Identity".**

- **Export history**: in the top bar click "**Export**" (chat history) → download a JSON backup file containing your **entire chat history and channel list**.
- **Import history**: in the top bar click "**Import**" (chat history) → pick the backup file → the app **merges and de-duplicates by message id** and **unions the channel names** (it won't overwrite your existing messages — it takes the union).
- **Key difference**: exporting history backs up **only the chat content, no keys at all**; after importing, encrypted content in private channels / DMs still requires the corresponding identity (imported or original) to decrypt. For a full migration, **also use "Export Identity" to carry the keys**.

> Recommend backing up important conversations periodically via "Export" (history). When switching devices, use "Export Identity" + "Export" (history) together so you restore both your account and all conversations on the new device.

---

## 8. Decentralized sync (lets messages cross devices / people)

By default your messages **stay only on your machine** and others can't reach you. To chat with friends, turn on sync and point to the same relay node:

1. Find the "**Decentralized sync**" switch in the top bar and turn it on;
2. In "**Relay address**" enter the relay URL you agreed on (e.g. `https://chat4-relay.onrender.com/gun`);
3. You and your friend enter **the same** relay address and join **the same** channel name to talk; after adding each other as friends you can DM or build a private channel together.

> Even with sync on, **chat history stays only in each person's own browser (IndexedDB)** — messages are just relayed to the other party. If you want "not even my messages leave this machine", keep sync **off**. Most free public relay nodes are dead; use a deployed relay address.

---

## 9. Language switch

- The top-right has "**中文 | EN**" buttons; click to switch the UI language instantly.
- Your choice is remembered (next open keeps your selected language).
- **On first open** it auto-matches your OS/browser language: Chinese system → Chinese UI, English → EN, otherwise defaults to EN.

---

## 10. FAQ

**Q: Messages won't send / friend can't see me?**
A: Check that "Decentralized sync" is on, the relay address is correct and reachable; confirm you're using the exact same channel name. Pure-local mode (sync off) is single-user by design — nobody can see you.

**Q: DM shows "cannot decrypt"?**
A: Usually the public keys don't match. Re-add the person via "＋ Friend" (Method A is most reliable), making sure both sides have each other's encryption public key.

**Q: Can I use my identity on a new phone/computer?**
A: Yes. Use "Export Identity" to back up `web3-identity.json`, then "Import Identity" on the new device to restore the same address and friend relationships.

**Q: Can others see my private channel?**
A: No. People who aren't approved see only ciphertext — no plaintext, and they can't post either.

**Q: Will I lose my history?**
A: As long as you don't clear browser cache/local storage, don't switch devices without a backup, the history stays. For important conversations, back up via "Export" (history) + "Export Identity".

**Q: Is this truly "decentralized"?**
A: Pure-local mode best fits "records stay only local". After enabling GunDB sync, messages are relayed across nodes via P2P — that's the real decentralized part. Both modes stay under your control.
