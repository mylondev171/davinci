import { createAdminClient } from '@/lib/supabase/admin'
import { searchEmailThreads, getThreadMessages } from '@/lib/google/gmail'
import { searchDriveFiles } from '@/lib/google/drive'
import { readDocContent } from '@/lib/google/docs'
import { readSpreadsheet } from '@/lib/google/sheets'
import { getDomainOverview, getDomainOrganicKeywords } from '@/lib/semrush/client'
import { getMarketingReports } from '@/lib/reportgarden/client'

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string,
  userId: string
): Promise<unknown> {
  const supabase = createAdminClient()

  try {
    switch (toolName) {
      case 'searchClients': {
        let query = supabase
          .from('clients')
          .select('*, contacts(first_name, last_name, email, is_primary)')
          .eq('org_id', orgId)
          .limit((args.limit as number) || 10)

        if (args.query) query = query.ilike('company_name', `%${args.query}%`)
        if (args.status) query = query.eq('status', args.status as string)

        const { data } = await query
        return data || []
      }

      case 'getClientDetails': {
        const { data } = await supabase
          .from('clients')
          .select(`
            *,
            contacts(*),
            projects(id, name, status, priority, due_date),
            activities(id, activity_type, title, created_at)
          `)
          .eq('id', args.clientId as string)
          .single()
        return data
      }

      case 'searchClientEmails': {
        let searchQuery = (args.searchQuery as string) || ''

        if (args.clientId) {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('email')
            .eq('client_id', args.clientId as string)
            .not('email', 'is', null)

          if (contacts && contacts.length > 0) {
            const emailQueries = contacts.map((c) => `from:${c.email} OR to:${c.email}`)
            searchQuery = emailQueries.join(' OR ')
          }
        }

        if (!searchQuery) return { error: 'No search criteria provided' }
        return await searchEmailThreads(orgId, userId, searchQuery, (args.maxResults as number) || 10)
      }

      case 'getEmailThread': {
        return await getThreadMessages(orgId, userId, args.threadId as string)
      }

      case 'searchDocuments': {
        if (args.clientId) {
          const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('client_id', args.clientId as string)
          return data || []
        }
        return await searchDriveFiles(orgId, userId, args.searchQuery as string)
      }

      case 'readDocument': {
        return await readDocContent(orgId, userId, args.docId as string)
      }

      case 'readSpreadsheet': {
        return await readSpreadsheet(orgId, userId, args.spreadsheetId as string, args.range as string)
      }

      case 'searchProjects': {
        let query = supabase
          .from('projects')
          .select('*, clients(id, company_name), tasks(id, status)')
          .eq('org_id', orgId)

        if (args.query) query = query.ilike('name', `%${args.query}%`)
        if (args.clientId) query = query.eq('client_id', args.clientId as string)
        if (args.status) query = query.eq('status', args.status as string)

        const { data } = await query
        return data || []
      }

      case 'getProjectDetails': {
        const { data } = await supabase
          .from('projects')
          .select(`
            *,
            clients(id, company_name),
            tasks(*, profiles:assignee_id(full_name)),
            milestones(*)
          `)
          .eq('id', args.projectId as string)
          .single()
        return data
      }

      case 'getTasksByAssignee': {
        let query = supabase
          .from('tasks')
          .select('*, projects(id, name)')
          .eq('org_id', orgId)

        if (args.userId) query = query.eq('assignee_id', args.userId as string)
        if (args.status) query = query.eq('status', args.status as string)

        const { data } = await query
        return data || []
      }

      case 'getSEOOverview': {
        return await getDomainOverview(orgId, args.domain as string, args.database as string)
      }

      case 'getKeywordRankings': {
        return await getDomainOrganicKeywords(
          orgId,
          args.domain as string,
          (args.limit as number) || 20,
          args.database as string
        )
      }

      case 'getMarketingReport': {
        return await getMarketingReports(orgId, args.clientDomain as string, userId)
      }

      case 'getClientActivity': {
        const { data } = await supabase
          .from('activities')
          .select('*')
          .eq('client_id', args.clientId as string)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit((args.limit as number) || 20)
        return data || []
      }

      // --- Write operations ---

      case 'createClient': {
        const { clientId, ...fields } = args as Record<string, unknown>
        const { data, error } = await supabase
          .from('clients')
          .insert({ ...fields, org_id: orgId })
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, client: data }
      }

      case 'updateClient': {
        const { clientId, ...updates } = args as Record<string, unknown>
        const { data, error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', clientId as string)
          .eq('org_id', orgId)
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, client: data }
      }

      case 'createProject': {
        const { projectId, ...fields } = args as Record<string, unknown>
        const { data, error } = await supabase
          .from('projects')
          .insert({ ...fields, org_id: orgId })
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, project: data }
      }

      case 'updateProject': {
        const { projectId, ...updates } = args as Record<string, unknown>
        if (updates.status === 'completed') {
          (updates as Record<string, unknown>).completed_at = new Date().toISOString()
        }
        const { data, error } = await supabase
          .from('projects')
          .update(updates)
          .eq('id', projectId as string)
          .eq('org_id', orgId)
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, project: data }
      }

      case 'createTask': {
        const { taskId, ...fields } = args as Record<string, unknown>
        const { data, error } = await supabase
          .from('tasks')
          .insert({ ...fields, org_id: orgId })
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, task: data }
      }

      case 'updateTask': {
        const { taskId, ...updates } = args as Record<string, unknown>
        if (updates.status === 'done') {
          (updates as Record<string, unknown>).completed_at = new Date().toISOString()
        } else if (updates.status) {
          (updates as Record<string, unknown>).completed_at = null
        }
        const { data, error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', taskId as string)
          .eq('org_id', orgId)
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, task: data }
      }

      case 'createContact': {
        const fields = args as Record<string, unknown>
        const { data, error } = await supabase
          .from('contacts')
          .insert({ ...fields, org_id: orgId })
          .select()
          .single()
        if (error) return { error: error.message }
        return { success: true, contact: data }
      }

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Tool execution failed' }
  }
}
