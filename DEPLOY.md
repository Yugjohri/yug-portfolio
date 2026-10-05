# Deploying yugjohri.me on Vercel

These are the steps you do by hand. Nothing here has been done for you: no
logins, no DNS changes.

## 1. Import the repo

1. Push the `launch-prep` branch (and merge it into the branch you deploy from).
2. Go to <https://vercel.com/new> and import **Yugjohri/yug-portfolio**.
3. Vercel detects Vite. Leave the defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Before the first deploy, add the environment variables (next step). The
   production build **fails on purpose** if they are missing, so the notes board
   can never silently fall back to local-only storage on the live site.

## 2. Environment variables

In the project's **Settings → Environment Variables**, add both for
**Production** (and Preview if you want preview deploys to work):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's **anon / publishable** key (never the service-role key) |

Both are in Supabase under **Project Settings → API**. See `.env.example`.
Then redeploy so the build picks them up.

Before you deploy, apply the two migrations in `supabase/migrations/` to the
project (Supabase dashboard → SQL editor, run each file in order, or
`supabase db push`).

## 3. Domains

In the Vercel project: **Settings → Domains**.

1. Add `yugjohri.me`.
2. Add `www.yugjohri.me` and choose **Redirect to yugjohri.me** (308).

Vercel then shows the DNS records it wants. Use exactly the values it shows.
At the time of writing they are usually:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com.` |

## 4. Namecheap DNS

Namecheap → **Domain List → yugjohri.me → Manage → Advanced DNS**:

1. Delete the four GitHub Pages A records on `@`
   (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
2. Delete the existing `www` CNAME (it points at the apex today).
3. Add the A record and the `www` CNAME from step 3, with the values Vercel shows.
4. Leave any MX / TXT records (email, verification) alone.

DNS usually updates within minutes, occasionally up to a few hours. Vercel's
Domains page turns green and issues the HTTPS certificate on its own.

## 5. Take the domain off GitHub Pages

So the two hosts don't fight over it:

1. Open the old portfolio's repository on GitHub → **Settings → Pages**.
2. Under **Custom domain**, clear `yugjohri.me` and save.
3. If that repo has a `CNAME` file at its root, delete it (otherwise Pages adds
   the domain back on the next build).
4. Optionally unpublish that Pages site entirely.

## 6. After it is live

1. Open `https://yugjohri.me`, `https://yugjohri.me/story` and
   `https://yugjohri.me/brief`, and hard-refresh each one (they must all load,
   not 404).
2. Check `https://www.yugjohri.me` redirects to the apex.
3. In the Vercel project, open **Analytics** and enable **Web Analytics**
   (the code for it is already in the site; it shows data once enabled).
4. Submit `https://yugjohri.me/sitemap.xml` in
   [Google Search Console](https://search.google.com/search-console)
   (add the domain as a property first, verifying it with the DNS TXT record
   Google gives you, added in Namecheap).
5. Paste the URL into LinkedIn's
   [Post Inspector](https://www.linkedin.com/post-inspector/) to check the
   link preview and refresh its cache.

## Hiding a note on the board

Notes have a `hidden` flag. To take one down, in the Supabase SQL editor:

```sql
update public.notes set hidden = true where id = '<note id>';
```
