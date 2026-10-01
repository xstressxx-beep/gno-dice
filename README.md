# 🎲 GNO-DICE

> 🌐 **English** (this page) · [中文](#中文) · [Español](#español) · [Français](#français)

A decentralized dice game on [Gno.land](https://gno.land). Live site: <https://gno-dice.vercel.app>

- Pick a number from **1 to 6** and bet between **1 and 10 GNOT**.
- If the die lands on your number, you win **5 times your bet**.
- **One roll every 10 minutes** per player.
- Everything happens in a **Gno smart contract**: it takes the bet, checks the roll, pays the winner and keeps the history.
- The game is **provably fair**: your number stays hidden while the **croupier** (a service run by the site) rolls the
  die, then it is revealed and checked by the contract. Nobody, neither you nor the house, can choose the result.

The site (Next.js) is the interface: it reads the contract for free and asks your **Adena** wallet to sign transactions.
The full security audit report is in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

---

## Contents

1. [What’s in the project](#1-whats-in-the-project)
2. [Run the site locally](#2-run-the-site-locally)
3. [Put the site online (GitHub + Vercel)](#3-put-the-site-online-github--vercel)
4. [Deploy the contract from the site (with Adena)](#4-deploy-the-contract-from-the-site-with-adena)
5. [Tests](#5-tests)
6. [Security and limits (read this!)](#6-security-and-limits-read-this)
7. [Moving to mainnet later](#7-moving-to-mainnet-later)
8. [Languages (i18n)](#8-languages-i18n)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What’s in the project

```
Gnodice/
├── contract/gnodice/        ← the Gno smart contract
│   ├── gnodice.gno          ← rules, data, the 3-step game explained
│   ├── game.gno             ← Play, Resolve, Reveal, Refund, Expire
│   ├── fairness.gno         ← hidden-number commitment and die computation (SHA-256)
│   ├── bank.gno             ← bank, reserve, circuit breaker, alerts
│   ├── admin.gno            ← pause, croupier, limits, blocklist, ownership
│   ├── api.gno              ← reads for the site (JSON)
│   ├── render.gno           ← readable page on gnoweb (with roll verification)
│   ├── gnodice_test.gno     ← 26 contract tests (including attacks and 1,000 games)
│   └── gnomod.toml
├── contract/audit/          ← proof of the old version’s flaw (read only)
├── e2e/                     ← end-to-end tests on a real local chain
├── messages/                ← site texts, one JSON file per language (en, zh, es, fr)
├── scripts/                 ← contract test runner, deploy preparation
├── src/
│   ├── app/                 ← pages: / (game), /admin, and /api/croupier (server)
│   ├── components/          ← UI pieces (3D die, game table, history…)
│   │   └── ui/              ← shadcn/ui base components (buttons, tabs, slider…)
│   ├── hooks/               ← regular reads of the contract data
│   ├── i18n/                ← language setup (next-intl)
│   └── lib/                 ← blockchain, Adena, fairness, croupier (lib/server) + tests
├── .env.example             ← settings template (network, contract, croupier)
├── vercel.json              ← croupier scheduled job
├── tailwind.config.ts       ← theme colors and animations (Tailwind CSS v3)
├── components.json          ← shadcn/ui settings
└── package.json
```

**Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS v3, shadcn/ui + Radix UI (keyboard-accessible components),
Framer Motion, React Spring, GSAP and React Three Fiber (3D die), next-intl (translations).

**Default network: Onyx (`onyx-1`)**, the official Gno.land testnet. It runs exactly the same code as mainnet, and its
GNOT are **free** (faucet), so you can test without risking real money.

---

## 2. Run the site locally

You need [Node.js](https://nodejs.org) v24.

```bash
npm install        # install dependencies (once)
npm run dev        # start the site on http://localhost:3000
```

Until the contract is deployed, the site says “The GNO-DICE contract isn’t deployed yet”: that’s expected.

---

## 3. Put the site online (GitHub + Vercel)

> ⚠️ **GNO-DICE and the “Gnosino” roulette are two separate projects.**
> `gnosino.vercel.app` is reserved for the roulette: do **not** connect this repository to that Vercel project.

1. Repository: <https://github.com/xstressxx-beep/gno-dice>.
2. Push the code: `git push -u origin main`.
3. On <https://vercel.com/new>, **import** the `gno-dice` repository as a **new** project. Vercel detects Next.js on its
   own: keep the default settings and click **Deploy**.

After that, every `git push` updates the site automatically.

---

## 4. Deploy the contract from the site (with Adena)

No Gno tooling needed: the site sends the contract, you sign in Adena.

1. In **Adena**, use the owner account **`g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff`** and pick the **Onyx** network (the
   site offers to switch otherwise).
2. **Get free GNOT** from <https://faucet.gno.land> (Onyx network). Plan for ~60 GNOT: 4 for deployment, 50 for the game
   bank, the rest to play.
3. Open **`https://<your-site>.vercel.app/admin`**, click **Connect Adena**, then **Deploy the contract**, and accept in Adena.
   - The contract is published at `gno.land/r/g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff/gnodice` and **you become its owner**.
   - Cost: a few GNOT **locked** as a storage deposit (the code takes space on the blockchain) + ~0.1 GNOT in fees
     (measured gas: ~59 million).
   - On Onyx, an official “oracle” checks the code before activating it: the status goes from *pending* to *✔ active*,
     usually within a few minutes. The page updates on its own.
4. **Set up the croupier** (required: without it, no die is rolled):
   - create a **new dedicated account** in Adena for the croupier, send it **5 GNOT** (to pay gas for its rolls) and
     write down its secret phrase;
   - on Vercel (Settings → Environment Variables), add **`CROUPIER_MNEMONIC`** = that secret phrase and
     **`CRON_SECRET`** = a long random string, then **redeploy**;
   - on `/admin`, in the monitoring section, click **Use this croupier** and accept in Adena;
   - ⚠️ never put this phrase in a `NEXT_PUBLIC_…` variable or in Git: it would become public.
5. Once the page shows that the contract is the one used by the site, **fund the bank** (bank section): it pays the
   winnings. To accept the maximum bet of 10 GNOT, it needs **at least 40 GNOT available**; 50 to 100 GNOT is a good start.
6. Go back to the home page: **you can play** 🎲

The contract is also visible on gnoweb:
<https://onyx.testnets.gno.land/r/g1u97n45s4s6q7vn5clr8339pv4up455hnqn4aff/gnodice>

**Deploying with another wallet?** The `/admin` page tells you and shows the exact path. Add it on Vercel
(Settings → Environment Variables → `NEXT_PUBLIC_GNODICE_REALM`), then **redeploy**: variables are built into the site.

---

## 5. Tests

**Site tests** (67 checks: fairness identical to the contract, croupier against a fake blockchain, monitoring,
transactions, error messages…):

```bash
npm test
```

**Contract tests** (26 tests: game rules, one attack per test, circuit breaker, 1,000 games). Requires Go and a clone of
the Gno repository ([install](https://docs.gno.land/builders/install)):

```bash
git clone https://github.com/gnolang/gno.git ~/tools/gno-src
cd ~/tools/gno-src && go install ./gnovm/cmd/gno ./contribs/gnodev
cd <Gnodice folder> && npm run test:contract     # GNO_ROOT / GNO_BIN if installed elsewhere
```

**End-to-end tests** (real transactions on a local chain: full game, cheating refused, 8 players in parallel). After
`npm run test:contract` (which copies the contract into `~/tools/gno-src/examples`), in a first terminal opened in
`~/tools/gno-src/examples`:

```bash
gnodev local -paths gno.land/r/example/gnodice -no-web -empty-blocks
```

then in a second terminal: `npm run test:e2e`.

Other checks: `npm run lint` (code quality) and `npm run build` (the same build as Vercel).

---

## 6. Security and limits (read this!)

Details (flaws found, fixes, tests) are in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). The essentials:

- **3-step game**: you bet on a **hidden** number (its SHA-256 commitment with a random secret kept in your browser) →
  the croupier rolls the die **without knowing your number** and publishes its seed → your number is revealed, the
  contract checks it and pays. The site recomputes every roll to verify it.
- **Don’t switch browsers between the bet and the end of the game**: the secret is kept in that browser. The site
  finishes the game on its own, usually within seconds.
- **Safety nets**: if the croupier doesn’t respond within 30 minutes, you get your bet back (“Get my bet back” button);
  a game never revealed expires after 7 days and counts as lost.
- **The bank reserves 5× every bet**: it can never promise more than it holds, and the owner can only withdraw the
  unreserved part.
- **Circuit breaker**: above 500 GNOT of winnings in a day (configurable), the game pauses itself.
- **Trust in the croupier**: it can’t cheat a player (it doesn’t know their number). If its key were stolen, the circuit
  breaker limits losses; switch croupier in `/admin`.
- **House edge**: 1 chance in 6 to win 5× → players get back 83% of their bets on average.
- **Player fees**: ~0.02 GNOT network fee per roll, and about 0.85 GNOT storage deposit on a player’s very first game.
- The site **never** sees your private key: Adena signs, you accept or refuse.

---

## 7. Moving to mainnet later

Gno.land mainnet (`gnoland-1`) launched on 2026-09-12. GNOT there have real value and there is no faucet. First follow
the **production checklist** in [SECURITY_AUDIT.md](SECURITY_AUDIT.md) and have the contract reviewed by an independent
auditor. Then redeploy the contract on mainnet and change the variables (values in `.env.example`).

---

## 8. Languages (i18n)

The site is available in **English** (default), **中文**, **Español** and **Français**, using
[next-intl](https://next-intl.dev). The language is picked automatically from the browser (English if it isn’t
available) and can be changed with the selector in the header; the choice is remembered in a cookie.

**Add a language** (e.g. German):

1. Copy `messages/en.json` to `messages/de.json` and translate the values (keep the keys and `{placeholders}`).
2. Add `de: "Deutsch"` to `LOCALES` in `src/i18n/config.ts`.

Missing keys in a translation fall back to English. The `/admin` page stays in French (owner only).

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| “Install Adena” although Adena is installed | Reload the page; check that Adena is unlocked. |
| “Switch network” | Click it and accept in Adena (Onyx is added if missing). |
| “Insufficient balance” | Top up your wallet at <https://faucet.gno.land>. |
| “Max possible bet: X GNOT” / “The bank is empty” | Fund the bank from `/admin`. |
| “Next roll in mm:ss” | That’s the 10-minute rule, be patient 🙂 |
| The contract stays “pending activation” | Onyx’s oracle is checking the code; wait a few minutes and reload `/admin`. |
| “The GNO-DICE contract isn’t deployed yet” | Deploy it from `/admin` (section 4). If you deployed with another wallet than `g1u97n…4aff`, add `NEXT_PUBLIC_GNODICE_REALM` on Vercel and **redeploy**. |
| The die doesn’t roll, no animation | Your device asks for reduced motion and the site respects it. Use the animation button in the header, or on Windows: Settings → Accessibility → Visual effects → **Animation effects**. |

---

## 中文

**GNO-DICE** 是一款运行在 [Gno.land](https://gno.land) 上的去中心化骰子游戏：从 1 到 6 中选一个数字，下注 1 到 10 GNOT，
骰子落在你的数字上即可赢得 **5 倍下注**，每位玩家每 10 分钟可掷一次。游戏**可证明公平**：荷官掷骰时不知道你的数字，
合约会在付款前验证结果。所有下注和赔付都公开记录在链上。

- 网站：<https://gno-dice.vercel.app>（钱包：[Adena](https://adena.app)，测试网免费 GNOT：<https://faucet.gno.land>）
- 本地运行：`npm install` 然后 `npm run dev`
- 安全审计：[SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- 完整文档请参阅上方英文版。

## Español

**GNO-DICE** es un juego de dados descentralizado en [Gno.land](https://gno.land): elige un número del 1 al 6, apuesta
entre 1 y 10 GNOT y gana **5 veces tu apuesta** si el dado cae en tu número. Una tirada cada 10 minutos por jugador.
El juego es **demostrablemente justo**: el crupier tira el dado sin conocer tu número y el contrato verifica el
resultado antes de pagar. Todas las apuestas y pagos son públicos en la cadena.

- Sitio: <https://gno-dice.vercel.app> (wallet: [Adena](https://adena.app), GNOT gratis en la testnet: <https://faucet.gno.land>)
- Ejecutar en local: `npm install` y luego `npm run dev`
- Auditoría de seguridad: [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- La documentación completa está en la versión en inglés de arriba.

## Français

**GNO-DICE** est un jeu de dés décentralisé sur [Gno.land](https://gno.land) : choisis un chiffre de 1 à 6, mise entre
1 et 10 GNOT et gagne **5 fois ta mise** si le dé tombe sur ton chiffre. Un lancer toutes les 10 minutes par joueur.
Le jeu est **prouvablement équitable** : le croupier tire le dé sans connaître ton chiffre et le contrat vérifie le
résultat avant de payer. Toutes les mises et tous les paiements sont publics sur la blockchain.

- Site : <https://gno-dice.vercel.app> (wallet : [Adena](https://adena.app), GNOT gratuits sur le testnet : <https://faucet.gno.land>)
- Lancer en local : `npm install` puis `npm run dev`
- Audit de sécurité : [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- La documentation complète est dans la version anglaise ci-dessus.
