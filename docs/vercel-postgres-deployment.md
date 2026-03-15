# Doumoti: Vercel + Vercel Postgres deployment checklist

## 1) Connect GitHub to Vercel

1. Push this repository to GitHub.
2. In Vercel Dashboard, click "Add New..." -> "Project".
3. Import the GitHub repository.
4. Keep Framework Preset as Next.js.
5. Set Root Directory to repository root if needed.
6. Click "Deploy" once to create the project.

## 2) Add Vercel Postgres

1. Open the Vercel project.
2. Go to Storage -> Create Database -> Postgres.
3. Choose region close to your users.
4. Attach the database to this project.
5. Confirm the integration has injected Postgres env vars.

## 3) Required environment variables

Set these in Vercel Dashboard -> Project -> Settings -> Environment Variables:

- POSTGRES_URL
- POSTGRES_PRISMA_URL
- POSTGRES_URL_NON_POOLING
- POSTGRES_USER
- POSTGRES_HOST
- POSTGRES_PASSWORD
- POSTGRES_DATABASE
- SESSION_SECRET (32+ bytes random string)
- PLAYBACK_TOKEN_SECRET (32+ bytes random string)
- STRIPE_WEBHOOK_SECRET (if Stripe webhook is enabled)
- DEV_LOGIN_SECRET (optional but strongly recommended; required to protect dev-login API)

Local `.env.local` example:

```env
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."
SESSION_SECRET="replace-with-32-byte-random"
PLAYBACK_TOKEN_SECRET="replace-with-32-byte-random"
STRIPE_WEBHOOK_SECRET="whsec_..."
DEV_LOGIN_SECRET="replace-with-long-random"
```

## 4) Apply schema

1. Open Storage -> Postgres -> Query in Vercel Dashboard.
2. Paste and run `database/001_init.sql`.
3. Insert seed rows into `videos` and (optionally) `users`.

## 5) Production safety checks

1. Ensure `NODE_ENV=production` in Vercel deployment.
2. Ensure dev login API is disabled in production, or guarded by `DEV_LOGIN_SECRET`.
3. Verify `/api/video/[id]` never returns raw `video_source_url`.
4. Verify `/api/video/[id]/stream` rejects invalid/expired tokens.
5. Confirm NORMAL account cannot renew beyond fixed 60-second preview window per video.

## 6) Verify after deploy

1. Test as NORMAL: VIP video returns preview access only.
2. Test as GENERAL: VIP video returns upgrade required.
3. Test as VIP: full access with HD entitlement.
4. Check Vercel Functions logs for blocked token replay and 403 responses.
