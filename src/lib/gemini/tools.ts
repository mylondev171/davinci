import { tool } from 'ai'
import { z } from 'zod'
import { executeToolCall } from './tool-handlers'
import type { Role } from '@/lib/permissions'

export function getCrmTools(orgId: string, userId: string, role: Role) {
  return {
    searchClients: tool({
      description: 'Search for clients by name, industry, or status. Returns matching client profiles with contacts.',
      inputSchema: z.object({
        query: z.string().optional().describe('Search term for client name or industry'),
        status: z.enum(['lead', 'prospect', 'active', 'on_hold', 'churned']).optional(),
        limit: z.number().default(10),
      }),
      execute: async (args) => executeToolCall('searchClients', args, orgId, userId),
    }),

    getClientDetails: tool({
      description: 'Get full details for a specific client including contacts, projects, and recent activity.',
      inputSchema: z.object({
        clientId: z.string().describe('The client UUID'),
      }),
      execute: async (args) => executeToolCall('getClientDetails', args, orgId, userId),
    }),

    searchClientEmails: tool({
      description: 'Search Gmail for email threads related to a specific client or by keywords.',
      inputSchema: z.object({
        clientId: z.string().optional().describe('Client UUID to find emails for (uses contact emails)'),
        searchQuery: z.string().optional().describe('Gmail search query or keywords'),
        maxResults: z.number().default(10),
      }),
      execute: async (args) => executeToolCall('searchClientEmails', args, orgId, userId),
    }),

    getEmailThread: tool({
      description: 'Get the full content of a specific email thread for summarization.',
      inputSchema: z.object({
        threadId: z.string().describe('Gmail thread ID'),
      }),
      execute: async (args) => executeToolCall('getEmailThread', args, orgId, userId),
    }),

    searchDocuments: tool({
      description: 'Search Google Drive documents or find documents linked to a client.',
      inputSchema: z.object({
        clientId: z.string().optional(),
        searchQuery: z.string().optional(),
      }),
      execute: async (args) => executeToolCall('searchDocuments', args, orgId, userId),
    }),

    readDocument: tool({
      description: 'Read the text content of a Google Doc.',
      inputSchema: z.object({
        docId: z.string().describe('Google Drive document ID'),
      }),
      execute: async (args) => executeToolCall('readDocument', args, orgId, userId),
    }),

    readSpreadsheet: tool({
      description: 'Read data from a Google Sheet.',
      inputSchema: z.object({
        spreadsheetId: z.string(),
        range: z.string().default('A1:Z100'),
      }),
      execute: async (args) => executeToolCall('readSpreadsheet', args, orgId, userId),
    }),

    searchProjects: tool({
      description: 'Search for projects by name, client, or status.',
      inputSchema: z.object({
        query: z.string().optional(),
        clientId: z.string().optional(),
        status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
      }),
      execute: async (args) => executeToolCall('searchProjects', args, orgId, userId),
    }),

    getProjectDetails: tool({
      description: 'Get full project details including all tasks, milestones, and team members.',
      inputSchema: z.object({
        projectId: z.string(),
      }),
      execute: async (args) => executeToolCall('getProjectDetails', args, orgId, userId),
    }),

    getTasksByAssignee: tool({
      description: 'Get tasks assigned to a specific team member or the current user.',
      inputSchema: z.object({
        userId: z.string().optional().describe('User ID. Omit to get all tasks.'),
        status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'blocked']).optional(),
      }),
      execute: async (args) => executeToolCall('getTasksByAssignee', args, orgId, userId),
    }),

    getSEOOverview: tool({
      description: 'Get SEMRush SEO overview for a domain. Returns organic traffic, rankings, and competitor data.',
      inputSchema: z.object({
        domain: z.string().describe('Website domain (e.g., example.com)'),
        database: z.string().default('us'),
      }),
      execute: async (args) => executeToolCall('getSEOOverview', args, orgId, userId),
    }),

    getKeywordRankings: tool({
      description: 'Get top organic keyword rankings for a domain from SEMRush.',
      inputSchema: z.object({
        domain: z.string(),
        limit: z.number().default(20),
        database: z.string().default('us'),
      }),
      execute: async (args) => executeToolCall('getKeywordRankings', args, orgId, userId),
    }),

    getMarketingReport: tool({
      description: 'Get marketing performance report for a client from ReportGarden data.',
      inputSchema: z.object({
        clientDomain: z.string(),
      }),
      execute: async (args) => executeToolCall('getMarketingReport', args, orgId, userId),
    }),

    getClientActivity: tool({
      description: 'Get the recent activity timeline for a client.',
      inputSchema: z.object({
        clientId: z.string(),
        limit: z.number().default(20),
      }),
      execute: async (args) => executeToolCall('getClientActivity', args, orgId, userId),
    }),

    // --- Write tools ---

    createClient: tool({
      description: 'Create a new client in the CRM.',
      inputSchema: z.object({
        company_name: z.string().describe('Company name'),
        industry: z.string().optional(),
        website: z.string().optional(),
        status: z.enum(['lead', 'prospect', 'active', 'on_hold', 'churned']).default('lead'),
        pipeline_stage: z.enum(['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost']).default('new'),
      }),
      execute: async (args) => executeToolCall('createClient', args, orgId, userId),
    }),

    updateClient: tool({
      description: 'Update an existing client. Only provide the fields you want to change.',
      inputSchema: z.object({
        clientId: z.string().describe('The client UUID to update'),
        company_name: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        status: z.enum(['lead', 'prospect', 'active', 'on_hold', 'churned']).optional(),
        pipeline_stage: z.enum(['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost']).optional(),
      }),
      execute: async (args) => executeToolCall('updateClient', args, orgId, userId),
    }),

    createProject: tool({
      description: 'Create a new project, optionally linked to a client.',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
        description: z.string().optional(),
        client_id: z.string().optional().describe('Client UUID to link this project to'),
        status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).default('planning'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        start_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
        due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
        budget: z.number().optional(),
      }),
      execute: async (args) => executeToolCall('createProject', args, orgId, userId),
    }),

    updateProject: tool({
      description: 'Update an existing project. Only provide the fields you want to change.',
      inputSchema: z.object({
        projectId: z.string().describe('The project UUID to update'),
        name: z.string().optional(),
        description: z.string().optional(),
        client_id: z.string().optional(),
        status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        start_date: z.string().optional(),
        due_date: z.string().optional(),
        budget: z.number().optional(),
      }),
      execute: async (args) => executeToolCall('updateProject', args, orgId, userId),
    }),

    createTask: tool({
      description: 'Create a new task within a project.',
      inputSchema: z.object({
        project_id: z.string().describe('Project UUID this task belongs to'),
        title: z.string().describe('Task title'),
        description: z.string().optional(),
        status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'blocked']).default('todo'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        assignee_id: z.string().optional().describe('User UUID to assign the task to'),
        due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
        estimated_hours: z.number().optional(),
      }),
      execute: async (args) => executeToolCall('createTask', args, orgId, userId),
    }),

    updateTask: tool({
      description: 'Update an existing task. Only provide the fields you want to change.',
      inputSchema: z.object({
        taskId: z.string().describe('The task UUID to update'),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'blocked']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignee_id: z.string().optional(),
        due_date: z.string().optional(),
        estimated_hours: z.number().optional(),
        actual_hours: z.number().optional(),
      }),
      execute: async (args) => executeToolCall('updateTask', args, orgId, userId),
    }),

    createContact: tool({
      description: 'Add a contact to a client.',
      inputSchema: z.object({
        client_id: z.string().describe('Client UUID this contact belongs to'),
        first_name: z.string(),
        last_name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        title: z.string().optional().describe('Job title'),
        is_primary: z.boolean().default(false),
      }),
      execute: async (args) => executeToolCall('createContact', args, orgId, userId),
    }),
  }
}
