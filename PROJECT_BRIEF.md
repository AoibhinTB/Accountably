# Accountability App — Project Brief

## What This Is
A social accountability app for friend groups. Users create shared challenges (e.g. "meditate daily", "cook for yourself 3x a week") that the whole group commits to together. When someone completes it, it shows up in a group feed. The core differentiator is the **group pact model** — everyone commits to the same habit together — rather than individuals tracking habits with an audience.

## Stack
- **Framework**: Next.js (App Router)
- **Backend/DB/Auth**: Supabase
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

Do not suggest alternative stacks or libraries unless there is a strong technical reason.

## Data Model

### `profiles` (extends Supabase auth.users)
- id (uuid, references auth.users)
- display_name (text)
- avatar_url (text, nullable)
- created_at (timestamptz)

### `groups`
- id (uuid)
- name (text)
- created_by (uuid, references profiles)
- invite_code (text, unique) — used for joining via link
- created_at (timestamptz)

### `group_members`
- id (uuid)
- group_id (uuid, references groups)
- user_id (uuid, references profiles)
- joined_at (timestamptz)

### `challenges`
- id (uuid)
- group_id (uuid, references groups)
- title (text)
- description (text, nullable)
- created_by (uuid, references profiles)
- frequency (enum: 'daily' | 'weekly')
- start_date (date)
- end_date (date, nullable) — null means runs indefinitely
- archived (boolean, default false)
- created_at (timestamptz)

### `completions`
- id (uuid)
- challenge_id (uuid, references challenges)
- user_id (uuid, references profiles)
- completed_at (timestamptz)
- note (text, nullable)

### `reactions`
- id (uuid)
- completion_id (uuid, references completions)
- user_id (uuid, references profiles)
- emoji (text)
- created_at (timestamptz)

## Key Relationships
- A user can belong to multiple groups
- A group has multiple challenges
- A challenge belongs to one group
- A completion belongs to one challenge and one user
- A reaction belongs to one completion

## Core User Flows
1. Sign up / log in
2. Create a group → get an invite link → share with friends
3. Join a group via invite link
4. Create a challenge within a group
5. Log a completion for a challenge (with optional note)
6. View the group feed — completions from all members, most recent first
7. React to someone's completion with an emoji

## Current Status
- [x] Project initialised
- [x] Supabase project created and schema applied
- [x] Auth wired
- [x] Groups: create + join via invite link
- [ ] Challenges: create within a group
- [ ] Completions: log a completion
- [ ] Feed: group feed showing all completions
- [ ] Reactions: emoji reactions on completions

Update this section as features are completed.

### Setup steps remaining
1. Create a Supabase project at https://supabase.com/dashboard.
2. Copy `.env.local.example` → `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API).
3. Apply the migrations in `supabase/migrations/` — either paste each file into the Supabase SQL editor in filename order, or run `supabase db push` after linking the project.
4. `npm run dev` and visit http://localhost:3000.

## Conventions
- Use Supabase client-side SDK for data fetching in Server Components where possible
- Use Row Level Security (RLS) on all Supabase tables — users should only see data for groups they belong to
- Keep components small and colocated with their route where possible
- Dates/times stored as UTC in Supabase, displayed in user's local timezone

## Decisions Made — Do Not Relitigate
- No chat feature in v1 — emoji reactions on completions are sufficient social layer for now
- No verification mechanism in v1 — honour system
- Challenges are group-wide commitments, not individual habit tracking
- Multiple groups per user supported from the start
