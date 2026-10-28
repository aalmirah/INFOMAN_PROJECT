# HOPE Inc. ERP

Foundational project scaffold for the HOPE Inc. ERP application, built with the
Next.js App Router, TypeScript, and Supabase.

## Prerequisites

- Node.js 20.9 or later
- npm
- A Supabase project (for features that use the Supabase client)

## Environment setup

1. Copy the example environment file to a local-only file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Replace the placeholder values in `.env.local` with the project URL and
   publishable key from your Supabase project's Connect panel:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

`.env.local` is ignored by Git. The publishable key is intended for browser use;
never put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

## Local development

Install dependencies and start the development server from the repository root:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the available project checks with:

```powershell
npm run lint
npm run typecheck
npm run build
```
