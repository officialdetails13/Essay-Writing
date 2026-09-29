# OverUnder

A private over/under prediction market for you and your friends. It uses points, not real money.

- **Sign up in one step** with a nickname, a passcode and an invite code.
- **The admin** (the first person to sign up) controls who can create events.
- **Events** have a title and an over/under line. Friends bet points on Over or Under.
- **Live odds** update every few seconds while people bet.
- **Leaderboard** and a bet history page for each player.

## How the odds work (shared pot)

This is the same system horse racing uses:

1. Every bet on **Over** goes into the Over pot. Every bet on **Under** goes into the Under pot.
2. When the event is settled, the **winning side splits both pots**, in proportion to how much each person bet.
3. Example: 300 points on Over and 700 on Under make a 1,000-point pot.
   - If Over wins, it pays **3.33x**. A 100-point Over bet returns 333.
   - If Under wins, it pays **1.43x**.
4. Odds move as bets come in. The unpopular side pays more.
5. **Push:** if the result lands exactly on the line, or nobody picked the winning side, everyone is refunded. Use `.5` lines (like 42.5) to avoid pushes.

Each player starts with 1,000 points. The admin can add or remove points (for example, a bailout for someone who went broke).

## Event lifecycle

| State | What happens |
| --- | --- |
| **Open** | Anyone can bet until the close time. Bets are final. |
| **Closed** | Betting is locked while the event waits for its result. |
| **Resolved** | The creator (or the admin) enters the actual number, and payouts happen automatically. |
| **Cancelled** | The creator or admin cancels, and every bet is refunded. |

Event creators can bet on their own events. Their bets show a `creator` tag.

## Deploy it (free, about 10 minutes)

You need a free Postgres database and somewhere to host the site.

1. **Database:** create a free project at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) and copy the Postgres connection string. Make sure it ends in `?sslmode=require`.
2. **Hosting:** go to [vercel.com](https://vercel.com), choose **Add New → Project**, and import this GitHub repo.
3. In Vercel's **Environment Variables**, add `DATABASE_URL` with the connection string from step 1.
4. Click **Deploy**. The database tables are created automatically on the first visit.
5. Open the site and **sign up first**. The first account becomes the admin.
6. Go to **Admin**, set an invite code, and send your friends the link and the code.
7. In Admin, tap **Allow creating events** for anyone you trust to make events.

## Run it locally

```bash
cp .env.example .env.local   # then put your DATABASE_URL in it
npm install
npm run dev                  # http://localhost:3000
```

## Rebranding

The app name, tagline and starting balance are in `lib/brand.ts`. Colors are CSS variables at the top of `app/globals.css`.

## Tech

Next.js (App Router, server actions) with Postgres through [`postgres`](https://github.com/porsager/postgres). Passcodes are hashed with bcrypt. Logins lock for 10 minutes after 5 wrong tries.
