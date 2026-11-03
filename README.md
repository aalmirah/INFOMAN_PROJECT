# HOPE Inc. ERP

Foundational project scaffold for the HOPE Inc. ERP application, built with the
Next.js App Router, TypeScript, and Supabase.

## Local-only development

- Node.js 20.9 or later
- npm
- Access to the team's Supabase development project

The Next.js app runs on each developer's computer at `http://localhost:3000`.
No hosted app or PR preview is required. Supabase remains a remote service used
by the local app for Auth and database access.

### Environment setup

Each developer must create their own `.env.local` in the repository root:

```powershell
Copy-Item .env.example .env.local
```

Set the values using credentials supplied through the team's approved secure
process:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

The URL and publishable key are available in the Supabase project's Connect
panel. Registration also requires the server-only `SUPABASE_SECRET_KEY` for
Supabase Admin Auth operations. Never put a secret/service-role key in a
`NEXT_PUBLIC_` variable, commit it, or send it in chat. `.env.local` is ignored
by Git. Use the team's development Supabase project and test accounts, not
production credentials or real user data.

## Local development

From the repository root, install dependencies and start the local server:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your own computer.
Other team members should clone/pull the PR branch, create their own
`.env.local`, and run the same commands locally. `localhost` is not shared
between computers. Restart `npm run dev` after changing `.env.local`.

For Google sign-in, configure the local callback URL
`http://localhost:3000/register?oauth=google` in the team's Supabase Auth and
Google provider settings. Do not change shared project settings without
coordinating with the DB Admin.

Run the available project checks with:

```powershell
npm run lint
npm run typecheck
npm run build
```
