# Supabase

Use the `blank` Supabase project for apps in this repository when database access is needed.

- Organization: `iammary52's Org`
- Project: `blank`
- Project ref: `gftydfeqpuavajjzaeun`
- Region: `ap-northeast-2` / Northeast Asia (Seoul)
- API URL: `https://gftydfeqpuavajjzaeun.supabase.co`
- Publishable key: stored in `.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Direct Postgres host: `db.gftydfeqpuavajjzaeun.supabase.co`
- Direct Postgres port: `5432`
- Direct Postgres database: `postgres`
- Direct Postgres user: `postgres`
- Storage bucket: `post-images`
- Posts table: `public.posts` with `id`, `message`, `image_path`, `created_at`

The database password is not visible after project creation in Supabase. If server-side direct Postgres access is needed and the password is unknown, reset it in Supabase Dashboard > Project Settings > Database.
