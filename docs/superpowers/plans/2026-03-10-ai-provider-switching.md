# AI Provider Switching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow org admins to configure Gemini and Claude API keys in Settings → Integrations; the chat route automatically uses Claude if available, falling back to Gemini, then env var.

**Architecture:** New `src/lib/ai/get-model.ts` resolves the AI model by reading `integration_credentials` for the org (same pattern as SEMRush). Chat route calls this helper instead of hardcoding `google('gemini-2.5-flash')`. Permissions extended so admins can manage all integrations.

**Tech Stack:** `@ai-sdk/anthropic`, `@ai-sdk/google`, Vercel AI SDK, Supabase, Next.js App Router

---

## Chunk 1: Permissions + Package

### Task 1: Install @ai-sdk/anthropic

**Files:**
- Modify: `package.json`

- [ ] Run install

```bash
cd "C:\Users\mylon\OneDrive\Desktop\Projects\AI Sites\geminicrmpms"
npm install @ai-sdk/anthropic
```

- [ ] Verify it appears in package.json dependencies

---

### Task 2: Extend permissions for admins

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] Add `manage_integrations` permission and update `manage_semrush` / `manage_reportgarden` to include admin

```ts
export type Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'manage_roles'
  | 'manage_integrations'

export type Role = 'owner' | 'admin' | 'member'

const PERMISSION_MAP: Record<Permission, Role[]> = {
  read: ['owner', 'admin', 'member'],
  create: ['owner', 'admin', 'member'],
  update: ['owner', 'admin', 'member'],
  delete: ['owner', 'admin'],
  invite: ['owner', 'admin'],
  manage_roles: ['owner', 'admin'],
  manage_integrations: ['owner', 'admin'],
}
```

- [ ] Commit

```bash
git add src/lib/permissions.ts
git commit -m "feat: add manage_integrations permission for owner+admin"
```

---

## Chunk 2: AI Model Resolver

### Task 3: Create get-model helper

**Files:**
- Create: `src/lib/ai/get-model.ts`

- [ ] Create `src/lib/ai/` directory and file

```ts
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getAiModel(orgId: string) {
  const supabase = createAdminClient()

  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('provider, api_key')
    .eq('org_id', orgId)
    .is('user_id', null)
    .eq('is_active', true)
    .in('provider', ['claude', 'gemini'])

  const claudeCred = credentials?.find((c) => c.provider === 'claude')
  if (claudeCred?.api_key) {
    const anthropic = createAnthropic({ apiKey: claudeCred.api_key })
    return anthropic('claude-sonnet-4-6')
  }

  const geminiCred = credentials?.find((c) => c.provider === 'gemini')
  if (geminiCred?.api_key) {
    const googleAI = createGoogleGenerativeAI({ apiKey: geminiCred.api_key })
    return googleAI('gemini-2.5-flash')
  }

  // Fallback to env var
  const googleAI = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
  })
  return googleAI('gemini-2.5-flash')
}
```

- [ ] Commit

```bash
git add src/lib/ai/get-model.ts
git commit -m "feat: add getAiModel helper — Claude > Gemini DB key > env fallback"
```

---

## Chunk 3: Wire Chat Route

### Task 4: Update chat route to use getAiModel

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] Replace `google('gemini-2.5-flash')` with `await getAiModel(orgId)`

```ts
import { getAiModel } from '@/lib/ai/get-model'
// remove: import { google } from '@ai-sdk/google'

// inside POST handler, replace:
const model = await getAiModel(orgId)
const result = streamText({
  model,
  system: getSystemPrompt(orgId, role),
  messages: await convertToModelMessages(messages),
  tools: getCrmTools(orgId, user.id, role),
  stopWhen: stepCountIs(10),
})
```

- [ ] Commit

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: chat route uses dynamic AI model (Claude or Gemini)"
```

---

## Chunk 4: Integrations UI

### Task 5: Update integrations page

**Files:**
- Modify: `src/app/(dashboard)/settings/integrations/page.tsx`

Changes:
1. Replace `isOwner` guards for SEMRush/ReportGarden with `can('manage_integrations')`
2. Add Claude card (API key input)
3. Add Gemini card (API key input, notes env var fallback)

- [ ] Update permission checks and add AI provider cards (full code in plan)

- [ ] Commit

```bash
git add src/app/(dashboard)/settings/integrations/page.tsx
git commit -m "feat: add Claude/Gemini integration cards, allow admins to manage all integrations"
```

---

## Chunk 5: System Prompt

### Task 6: Update system prompt for general Google Workspace access

**Files:**
- Modify: `src/lib/gemini/system-prompt.ts`

- [ ] Add guidance that tools can be used generally (not just for specific clients), and mention Drive/Docs/Sheets/Gmail general search capability

- [ ] Commit

```bash
git add src/lib/gemini/system-prompt.ts
git commit -m "feat: update system prompt for general Google Workspace read access"
```
