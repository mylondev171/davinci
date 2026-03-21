import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeToolCall } from '@/lib/gemini/tool-handlers'
import crypto from 'crypto'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// Tool definitions — JSON Schema format required by the MCP protocol
// ---------------------------------------------------------------------------

const MCP_TOOLS = [
  // --- Read tools ---
  {
    name: 'searchClients',
    description: 'Search for clients by name, industry, or status. Returns matching client profiles with contacts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for client name or industry' },
        status: { type: 'string', enum: ['lead', 'prospect', 'active', 'on_hold', 'churned'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'getClientDetails',
    description: 'Get full details for a specific client including contacts, projects, and recent activity.',
    inputSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: { type: 'string', description: 'The client UUID' },
      },
    },
  },
  {
    name: 'searchProjects',
    description: 'Search for projects by name, client, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        clientId: { type: 'string' },
        status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
      },
    },
  },
  {
    name: 'getProjectDetails',
    description: 'Get full project details including all tasks, milestones, and team members.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
  {
    name: 'getTasksByAssignee',
    description: 'Get tasks assigned to a specific team member, or all tasks if no userId is given.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID. Omit to get all tasks.' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] },
      },
    },
  },
  {
    name: 'getClientActivity',
    description: 'Get the recent activity timeline for a client.',
    inputSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'getSEOOverview',
    description: 'Get SEMRush SEO overview for a domain. Returns organic traffic, rankings, and competitor data.',
    inputSchema: {
      type: 'object',
      required: ['domain'],
      properties: {
        domain: { type: 'string', description: 'Website domain e.g. example.com' },
        database: { type: 'string', default: 'us' },
      },
    },
  },
  {
    name: 'getKeywordRankings',
    description: 'Get top organic keyword rankings for a domain from SEMRush.',
    inputSchema: {
      type: 'object',
      required: ['domain'],
      properties: {
        domain: { type: 'string' },
        limit: { type: 'number', default: 20 },
        database: { type: 'string', default: 'us' },
      },
    },
  },
  // --- Write tools ---
  {
    name: 'createClient',
    description: 'Create a new client in the CRM.',
    inputSchema: {
      type: 'object',
      required: ['company_name'],
      properties: {
        company_name: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        status: { type: 'string', enum: ['lead', 'prospect', 'active', 'on_hold', 'churned'], default: 'lead' },
        pipeline_stage: { type: 'string', enum: ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'], default: 'new' },
      },
    },
  },
  {
    name: 'updateClient',
    description: 'Update an existing client. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: { type: 'string', description: 'The client UUID to update' },
        company_name: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        status: { type: 'string', enum: ['lead', 'prospect', 'active', 'on_hold', 'churned'] },
        pipeline_stage: { type: 'string', enum: ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'] },
      },
    },
  },
  {
    name: 'createProject',
    description: 'Create a new project, optionally linked to a client.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        client_id: { type: 'string' },
        status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        budget: { type: 'number' },
      },
    },
  },
  {
    name: 'updateProject',
    description: 'Update an existing project. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        start_date: { type: 'string' },
        due_date: { type: 'string' },
        budget: { type: 'number' },
      },
    },
  },
  {
    name: 'createTask',
    description: 'Create a new task within a project.',
    inputSchema: {
      type: 'object',
      required: ['project_id', 'title'],
      properties: {
        project_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'], default: 'todo' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        assignee_id: { type: 'string' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        estimated_hours: { type: 'number' },
      },
    },
  },
  {
    name: 'updateTask',
    description: 'Update an existing task. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        assignee_id: { type: 'string' },
        due_date: { type: 'string' },
        estimated_hours: { type: 'number' },
        actual_hours: { type: 'number' },
      },
    },
  },
  {
    name: 'createContact',
    description: 'Add a contact to a client.',
    inputSchema: {
      type: 'object',
      required: ['client_id', 'first_name', 'last_name'],
      properties: {
        client_id: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        title: { type: 'string', description: 'Job title' },
        is_primary: { type: 'boolean', default: false },
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function authenticate(request: NextRequest): Promise<{ orgId: string; userId: string } | null> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const key = auth.slice(7)
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('mcp_api_keys')
    .select('id, org_id, created_by')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single()

  if (!data) return null

  // Update last_used_at without blocking the response
  supabase
    .from('mcp_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { orgId: data.org_id, userId: data.created_by }
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request)
  if (!ctx) return rpcError(null, -32001, 'Unauthorized')

  let body: { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const { id = null, method, params = {} } = body

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'gemini-crm', version: '1.0.0' },
      })

    case 'notifications/initialized':
      // Client acknowledgment — no response body needed
      return new NextResponse(null, { status: 202 })

    case 'tools/list':
      return rpcResult(id, { tools: MCP_TOOLS })

    case 'tools/call': {
      const toolName = params.name as string
      const args = (params.arguments ?? {}) as Record<string, unknown>

      if (!MCP_TOOLS.find((t) => t.name === toolName)) {
        return rpcError(id, -32602, `Unknown tool: ${toolName}`)
      }

      try {
        const result = await executeToolCall(toolName, args, ctx.orgId, ctx.userId)
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        })
      } catch (err) {
        return rpcResult(id, {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'Tool execution failed' }],
          isError: true,
        })
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

// Some MCP clients send a GET first to discover the endpoint
export async function GET() {
  return NextResponse.json({
    name: 'gemini-crm',
    version: '1.0.0',
    description: 'MCP server for GeminiCRM — manage clients, projects, tasks, and contacts.',
    transport: 'streamable-http',
  })
}
