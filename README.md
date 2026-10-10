# Mobile Campus

A mobile-first web platform for Nigerian university students — built first for **Delta State University (DELSU), Abraka**.

It brings together the five things a student actually needs when moving off campus, in one place, with trust built in:

| Feature | What it does |
| --- | --- |
| **Verified housing** | Real rooms in Ekrejeta, Ajalomi, Uruoka and Oria with price, water, light, distance to the gate, photos and the caretaker's number |
| **Roommates** | A 6-question quiz, a compatibility score, and a board for groups of 2, 3, 4 or more — with split rent tracked per person |
| **Marketplace** | Students selling to students, plus a "Graduating Student Drop" section |
| **Micro-gigs** | Laundry, food runs, braiding, tutoring — paid through escrow |
| **AI Budget Assistant** | "I have 150k" → real listings you can actually afford, with the maths shown |

Everything that involves money goes through **escrow**: the buyer pays us, we hold it, and it only moves when the buyer confirms. That single idea is what makes strangers willing to trade with each other.

---

## 1. What is in the box

```
Next.js 14 (App Router) + TypeScript + Tailwind CSS   → the app
Next.js API routes                                    → the backend (no separate server)
PostgreSQL + Prisma                                   → the database
Flutterwave                                           → payments, escrow payouts, webhooks
Termii                                                → SMS and OTP codes
Cloudinary                                            → image upload + automatic compression
Anthropic Claude                                      → the AI Budget Assistant (server-side only)
Framer Motion + Lottie                                → animation
```

Money is stored in **kobo** (`1 naira = 100 kobo`) as integers everywhere. Never store money as a float — rounding errors on someone's rent is how you lose their trust and your own.

---

## 2. Requirements

Install these three things first:

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | 18.17 or newer (20+ recommended) | `node -v` |
| npm | Comes with Node | `npm -v` |
| PostgreSQL | 13 or newer | `psql --version` |

If you do not have PostgreSQL, the free options that take five minutes are [Supabase](https://supabase.com), [Neon](https://neon.tech) or [Railway](https://railway.app) — all three give you a connection string you can paste straight into `.env`.

---

## 3. Install and run

Run these from inside the `mobile-campus` folder.

### Step 1 — Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via the `postinstall` script), which builds the type-safe database client.

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Then open `.env` and fill it in. **Never commit `.env`** — it is already in `.gitignore`.

Only two values are strictly required to get the app running locally:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mobile_campus?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Everything else has a graceful fallback (see [What happens if a service is not configured](#6-what-happens-if-a-service-is-not-configured)).

#### Generating the two secrets

`SESSION_SECRET` and `FIELD_ENCRYPTION_KEY` must be long random strings. Generate them with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run it twice and paste one result into each. `FIELD_ENCRYPTION_KEY` **must be at least 32 characters** — it is the key that encrypts matric numbers, JAMB numbers and ID numbers at rest.

### Step 3 — Create the database

```bash
# Create an empty database called mobile_campus
createdb mobile_campus        # or do it in your provider's dashboard

# Create all the tables from prisma/schema.prisma
npx prisma db push
```

`db push` is the quick way for development. For a real deployment with version-controlled history, use `npx prisma migrate dev --name init` instead (or `npm run prisma:migrate`).

### Step 4 — Fill it with demo data

```bash
npm run db:seed
```

This creates 6 lodges, 7 market items, 5 gigs, roommate posts, and the platform fee configuration.

### Step 5 — Start the app

```bash
npm run dev
```

Open **http://localhost:3000**.

---

## 4. Signing in to test

Every demo account uses the password in `SEED_PASSWORD` (default `password123`).

| Phone number | Who | What you can do |
| --- | --- | --- |
| `08030000001` | Chidera Okafor — verified 300L student | Everything: pay, escrow, message, review, post gigs |
| `08030000002` | Tunde Bakare — provisional fresher | Browse and shortlist only (see how the locked state feels) |
| `08030000003` | Emeka Nwosu — verified graduating seller | Sell items on the market |
| `08030000010` | Landlord | Listings, viewing requests, collect rent |
| `08030000099` | Admin | Verification queue, disputes, reports, fee editor, revenue |

---

## 5. Useful commands

```bash
npm run dev            # development server with hot reload
npm run build          # production build (runs prisma generate first)
npm start              # serve the production build
npm run lint           # ESLint
npm run typecheck      # TypeScript check with no output files
npm run prisma:studio  # browse your data in a browser UI
npm run db:seed        # re-fill the demo data
```

---

## 6. What happens if a service is not configured

The app is built so you can develop without any paid accounts. Each service degrades deliberately:

| Service | Missing key means |
| --- | --- |
| **Termii** | No SMS is sent. OTP codes are **printed to your terminal** and shown on screen in a yellow box, so you can still sign up and log in. Look for `[DEV OTP] 08030000001 -> 123456`. |
| **Flutterwave** | Payments return a clear error instead of silently pretending to succeed. Escrow records are still created so you can test the state machine. |
| **Cloudinary** | Image uploads fail with a readable message. The seed data uses public placeholder images, so the app still looks right. |
| **Anthropic Claude** | The Budget Assistant **automatically falls back** to the built-in rule-based parser (`src/lib/fallback-parse.ts`). It still understands "150k" and "a room under 80k" — it just cannot handle free-form sentences as well. You will see a "rule-based" badge instead of the AI badge. |

---

## 7. Getting the third-party accounts

You only need these when you are ready to go live.

### Flutterwave (payments)

1. Sign up at [flutterwave.com](https://flutterwave.com) and complete business verification.
2. In **Settings → API Keys**, copy your **test** keys into `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY` and `FLW_ENCRYPTION_KEY`.
3. Keep `FLW_TEST_MODE="true"` until you are sure everything works. Test card: `4242 4242 4242 4242`, any future expiry, CVV `564`, OTP `12345`.
4. For webhooks, add `https://your-domain.com/api/webhooks/flutterwave` in **Settings → Webhooks** and set a secret hash. Put that same hash in `FLW_WEBHOOK_HASH`.
5. For escrow payouts, add your settlement bank code and account number.

> The webhook verifies the `verif-hash` header **and** re-checks every transaction against Flutterwave's `/v3/transactions/:id/verify` endpoint. A payment is never marked paid because the browser said so.

### Termii (SMS)

1. Sign up at [termii.com](https://termii.com).
2. Copy your API key into `TERMII_API_KEY`.
3. Register a Sender ID (e.g. `MobileCampus`) and put it in `TERMII_SENDER_ID`. Unregistered sender IDs still send, but as a random number.

### Cloudinary (images)

1. Sign up at [cloudinary.com](https://cloudinary.com) — the free tier is enough to start.
2. Copy your **cloud name** into `CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
3. In **Settings → Upload**, create an **unsigned** upload preset (e.g. `mobile-campus-unsigned`) and enable the transformation `f_auto,q_auto,w_1600`. That preset is what compresses every photo automatically — a 4 MB phone photo becomes roughly 150 KB.
4. Put the preset name in `CLOUDINARY_UPLOAD_PRESET` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

### Anthropic Claude (the AI assistant)

1. Get a key at [console.anthropic.com](https://console.anthropic.com).
2. Put it in `ANTHROPIC_API_KEY`.
3. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-5`.

> The key is **server-side only**. It is read inside `src/app/api/budget/chat/route.ts` and never appears in a client component. The AI receives only the sentence the student typed — never a name, phone number or matric number — and it returns a strict JSON intent that we use to query **our own database**. It cannot invent a listing, because it does not return listings at all.

---

## 8. Deploying

### Option A — Vercel (easiest)

1. Push the folder to GitHub.
2. Import the repository at [vercel.com](https://vercel.com).
3. Add every variable from `.env` under **Settings → Environment Variables**.
4. Deploy. Vercel runs `npm run build`, which runs `prisma generate` first.
5. Run the schema and seed once against your production database:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
   (or use a GitHub Action / the Vercel CLI for this)

### Option B — Any Node host (Railway, Render, Fly, a VPS)

```bash
npm ci
npm run build
npm start
```

Set `NEXT_PUBLIC_APP_URL` to your real domain, and set `NODE_ENV=production`.

### After deploying — three things to do

1. **Update the Flutterwave webhook URL** to the live domain, and set `FLW_TEST_MODE="false"` plus your live keys when you are ready for real money.
2. **Rotate `SESSION_SECRET`** if you ever used the placeholder value in a public place. Every user will be signed out — that is expected and safe.
3. **Change `SEED_PASSWORD`** or delete the demo accounts before real students sign up:
   ```sql
   DELETE FROM "User" WHERE phone LIKE '080300000%';
   ```

### PWA

The app installs to a phone home screen. `public/manifest.webmanifest` declares the icons and shortcuts, and `public/sw.js` caches the app shell so it opens offline and shows the friendly `/offline` page when the network drops.

---

## 9. How the project is organised

```
prisma/
  schema.prisma     22 models, fully commented. Money is Int kobo.
  seed.ts           Demo data + the fee configuration.

src/
  app/
    layout.tsx      Root layout. Reads the session once, passes it to Shell.
    page.tsx        Home screen.
    api/            45 API routes — this IS the backend.
    housing/        Browse, detail, new listing.
    market/         Buy and sell.
    gigs/           Micro-gig board.
    roommates/      Quiz, matches, board, post detail.
    budget/         The AI Budget Assistant's own tab.
    escrow/         Payment list and payment detail.
    profile/        Account, verification, roommate answers.
    shortlist/      Everything a user saved.
    notifications/  In-app inbox.
    landlord/       Landlord dashboard, listing manager, viewing replies.
    admin/          Dashboard, verifications, disputes, reports, listings, fees.
    auth/           Signup, login, OTP verify.

  components/
    ui/             Buttons, cards, inputs, modal, toasts, skeletons, icons.
    layout/         Shell, bottom nav, desktop nav, page header, floating AI button.
    motion/         Page transitions and staggered lists.
    housing/ market/ gigs/ roommates/ escrow/ budget/ admin/ landlord/ shared/

  lib/
    prisma.ts       One shared database connection.
    auth.ts         Sessions, password hashing, role checks.
    encrypt.ts      AES-256-GCM for matric/JAMB/ID numbers.
    fees.ts         Reads FeeConfig — the ONLY place fees are calculated.
    escrow.ts       Server-side escrow logic.
    escrow-state.ts The pure state machine (safe for the browser).
    flutterwave.ts  Payments, verification, webhook hash check, transfers.
    termii.ts       SMS that never throws.
    budget-ai.ts    Claude, strict JSON, no private data.
    fallback-parse.ts  The non-AI parser used when Claude is unavailable.
    budget-match.ts Builds the "you can afford / short by ₦X" plan.
    validators.ts   Every zod schema, one per route.

  hooks/            useFetch, useReducedMotionPreference.
  types/            Shared TypeScript types.
```

---

## 10. Things worth knowing before you change code

**Fees come from the database, never from code.** `src/lib/fees.ts` reads the `FeeConfig` table. If you want to change the 2% housing fee, use the admin fee editor at `/admin/fees` — do not edit a number in a file.

**Money is kobo.** `₦45,000` is stored as `4500000`. Use `toKobo()`, `toNaira()` and `formatNaira()` from `src/lib/money.ts` rather than doing the maths by hand.

**Validation happens twice.** Zod validates in the browser (for a fast message) and again on the server (because a browser can send anything). Never remove the server-side `safeParse`.

**Encrypted fields are never returned.** `matricNumberEnc`, `jambRegNumberEnc` and `nationalIdEnc` are stored encrypted and are deliberately left out of every `select` that faces a user. Admins see only the last four digits.

**The escrow state machine is one-directional.** `PENDING_PAYMENT → HELD → CONFIRMED → RELEASED`, with `HELD → DISPUTED → RELEASED | REFUNDED`. `src/lib/escrow-state.ts` rejects any other move. Do not add a shortcut.

**Client components cannot import server modules.** `src/lib/escrow-state.ts` and `src/lib/cloudinary-url.ts` exist precisely so browser code can use pure helpers without dragging `next/headers` or secret environment variables into the bundle. If you add a helper that a client component needs, put it in a file with no server imports.

**Animations respect `prefers-reduced-motion`.** Every animation uses Framer Motion's `useReducedMotion()` or the CSS media query in `globals.css`. Keep it that way.

**Tap targets are at least 44px.** The design starts at 360px wide. If you add a button, use `Button` rather than a bare `<button>` so it inherits the right size.

---

## 11. Testing the money flow by hand

1. Sign in as `08030000001` / `password123`.
2. Go to **Market**, open the generator, tap **Buy with escrow**.
3. Check the fee sheet — item price, the 3% escrow fee, and the total. It must match the `FeeConfig` row.
4. Complete the payment (test card details are above).
5. Open **Escrow** → the payment is **HELD**.
6. Tap **I received it — release the money**. It moves to **CONFIRMED**.
7. Sign out, sign in as the seller, open the same payment, and tap **Collect**. It moves to **RELEASED**.

To test the dispute path instead, raise a dispute at step 6 and resolve it as `08030000099` at `/admin/disputes`.

---

## 12. Support

For anything about the code, start with the comments — every file, function, model and route explains what it does and why.
