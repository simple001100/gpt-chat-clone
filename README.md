# GPT Chat Clone

A ChatGPT-like web app built with Next.js, Supabase, and streaming LLM responses.

## Tech Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth, Postgres, Storage)
- TanStack Query
- Tailwind CSS + Radix UI
- Gemini API (streaming responses)

## Run Locally

1. Install dependencies:
   - `npm install`
2. Configure environment variables:
   - create/update `.env` and `.env.local` (Supabase keys, Gemini key, etc.)
3. Start development server:
   - `npm run dev`
4. Open:
   - [http://localhost:3000](http://localhost:3000)

## Environment Variables (Example)

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_gemini_api_key

# Optional (mock LLM responses for local testing)
MOCK_LLM=false
```

## Run with Docker

1. Build and start:
   - `docker compose up --build`
2. Open:
   - [http://localhost:3000](http://localhost:3000)

## Useful Commands

- `npm run lint` — run ESLint
- `npm run build` — production build check
