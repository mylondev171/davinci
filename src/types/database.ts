export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          plan: string
          settings: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          plan?: string
          settings?: Record<string, unknown>
        }
        Update: {
          name?: string
          slug?: string
          logo_url?: string | null
          plan?: string
          settings?: Record<string, unknown>
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          email: string
          default_org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          default_org_id?: string | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          default_org_id?: string | null
        }
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          user_id: string
          org_id: string
          role?: 'owner' | 'admin' | 'member'
        }
        Update: {
          role?: 'owner' | 'admin' | 'member'
        }
      }
      clients: {
        Row: {
          id: string
          org_id: string
          company_name: string
          industry: string | null
          website: string | null
          status: 'lead' | 'prospect' | 'active' | 'on_hold' | 'churned'
          pipeline_stage: 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost'
          logo_url: string | null
          address: Record<string, unknown> | null
          custom_fields: Record<string, unknown>
          notes_summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          company_name: string
          industry?: string | null
          website?: string | null
          status?: 'lead' | 'prospect' | 'active' | 'on_hold' | 'churned'
          pipeline_stage?: 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost'
          logo_url?: string | null
          address?: Record<string, unknown> | null
          custom_fields?: Record<string, unknown>
        }
        Update: {
          company_name?: string
          industry?: string | null
          website?: string | null
          status?: 'lead' | 'prospect' | 'active' | 'on_hold' | 'churned'
          pipeline_stage?: 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost'
          logo_url?: string | null
          address?: Record<string, unknown> | null
          custom_fields?: Record<string, unknown>
          notes_summary?: string | null
        }
      }
      contacts: {
        Row: {
          id: string
          org_id: string
          client_id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          title: string | null
          is_primary: boolean
          linkedin: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          client_id: string
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          title?: string | null
          is_primary?: boolean
          linkedin?: string | null
          notes?: string | null
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          title?: string | null
          is_primary?: boolean
          linkedin?: string | null
          notes?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          name: string
          description: string | null
          status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          start_date: string | null
          due_date: string | null
          completed_at: string | null
          budget: number | null
          tags: string[]
          custom_fields: Record<string, unknown>
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          name: string
          client_id?: string | null
          description?: string | null
          status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          start_date?: string | null
          due_date?: string | null
          budget?: number | null
          tags?: string[]
          custom_fields?: Record<string, unknown>
          created_by?: string | null
        }
        Update: {
          name?: string
          client_id?: string | null
          description?: string | null
          status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          start_date?: string | null
          due_date?: string | null
          completed_at?: string | null
          budget?: number | null
          tags?: string[]
          custom_fields?: Record<string, unknown>
        }
      }
      tasks: {
        Row: {
          id: string
          org_id: string
          project_id: string
          parent_task_id: string | null
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          assignee_id: string | null
          due_date: string | null
          estimated_hours: number | null
          actual_hours: number | null
          position: number
          tags: string[]
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          project_id: string
          title: string
          parent_task_id?: string | null
          description?: string | null
          status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assignee_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          position?: number
          tags?: string[]
        }
        Update: {
          title?: string
          parent_task_id?: string | null
          description?: string | null
          status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assignee_id?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          actual_hours?: number | null
          position?: number
          tags?: string[]
          completed_at?: string | null
        }
      }
      notes: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          project_id: string | null
          task_id: string | null
          author_id: string
          content: string
          pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          author_id: string
          content: string
          client_id?: string | null
          project_id?: string | null
          task_id?: string | null
          pinned?: boolean
        }
        Update: {
          content?: string
          pinned?: boolean
        }
      }
      activities: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          project_id: string | null
          task_id: string | null
          actor_id: string | null
          activity_type: string
          title: string
          description: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          org_id: string
          activity_type: string
          title: string
          client_id?: string | null
          project_id?: string | null
          task_id?: string | null
          actor_id?: string | null
          description?: string | null
          metadata?: Record<string, unknown>
        }
        Update: never
      }
      chat_sessions: {
        Row: {
          id: string
          org_id: string
          user_id: string
          title: string | null
          messages: unknown[]
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          user_id: string
          title?: string | null
          messages?: unknown[]
        }
        Update: {
          title?: string | null
          messages?: unknown[]
        }
      }
      integration_credentials: {
        Row: {
          id: string
          org_id: string
          provider: 'google' | 'semrush' | 'reportgarden'
          user_id: string | null
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          scopes: string[] | null
          api_key: string | null
          account_email: string | null
          connected_by: string | null
          is_active: boolean
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          provider: 'google' | 'semrush' | 'reportgarden'
          user_id?: string | null
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          scopes?: string[] | null
          api_key?: string | null
          account_email?: string | null
          connected_by?: string | null
          is_active?: boolean
          last_synced_at?: string | null
        }
        Update: {
          user_id?: string | null
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          scopes?: string[] | null
          api_key?: string | null
          account_email?: string | null
          is_active?: boolean
          last_synced_at?: string | null
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'lead' | 'member'
        }
        Insert: {
          project_id: string
          user_id: string
          role?: 'lead' | 'member'
        }
        Update: {
          role?: 'lead' | 'member'
        }
      }
      milestones: {
        Row: {
          id: string
          org_id: string
          project_id: string
          name: string
          description: string | null
          due_date: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          org_id: string
          project_id: string
          name: string
          description?: string | null
          due_date?: string | null
          completed?: boolean
        }
        Update: {
          name?: string
          description?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
        }
      }
      email_threads: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          gmail_thread_id: string
          gmail_message_ids: string[]
          subject: string | null
          snippet: string | null
          participants: Record<string, unknown> | null
          last_message_at: string | null
          message_count: number
          labels: string[]
          is_read: boolean
          raw_messages: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          gmail_thread_id: string
          client_id?: string | null
          gmail_message_ids?: string[]
          subject?: string | null
          snippet?: string | null
          participants?: Record<string, unknown> | null
          last_message_at?: string | null
          message_count?: number
          labels?: string[]
          is_read?: boolean
          raw_messages?: Record<string, unknown> | null
        }
        Update: {
          client_id?: string | null
          gmail_message_ids?: string[]
          subject?: string | null
          snippet?: string | null
          participants?: Record<string, unknown> | null
          last_message_at?: string | null
          message_count?: number
          labels?: string[]
          is_read?: boolean
          raw_messages?: Record<string, unknown> | null
        }
      }
      org_invitations: {
        Row: {
          id: string
          org_id: string
          email: string
          role: 'owner' | 'admin' | 'member'
          invited_by: string
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'revoked'
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          org_id: string
          email: string
          role?: 'owner' | 'admin' | 'member'
          invited_by: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          expires_at?: string
        }
        Update: {
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          accepted_at?: string | null
        }
      }
      client_credentials: {
        Row: {
          id: string
          org_id: string
          client_id: string
          created_by: string
          platform_name: string
          platform_url: string | null
          username: string
          encrypted_password: string
          poc: string | null
          scope: 'organization' | 'personal'
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          client_id: string
          created_by: string
          platform_name: string
          platform_url?: string | null
          username: string
          encrypted_password: string
          poc?: string | null
          scope?: 'organization' | 'personal'
        }
        Update: {
          platform_name?: string
          platform_url?: string | null
          username?: string
          encrypted_password?: string
          poc?: string | null
          scope?: 'organization' | 'personal'
        }
      }
      service_memberships: {
        Row: {
          id: string
          org_id: string
          service_name: string
          service_url: string | null
          membership_level: string | null
          cost: number | null
          billing_cycle: 'monthly' | 'yearly' | null
          flagged_for_removal: boolean
          flagged_at: string | null
          last_reminder_sent_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          org_id: string
          service_name: string
          service_url?: string | null
          membership_level?: string | null
          cost?: number | null
          billing_cycle?: 'monthly' | 'yearly' | null
          flagged_for_removal?: boolean
          flagged_at?: string | null
          created_by: string
        }
        Update: {
          service_name?: string
          service_url?: string | null
          membership_level?: string | null
          cost?: number | null
          billing_cycle?: 'monthly' | 'yearly' | null
          flagged_for_removal?: boolean
          flagged_at?: string | null
          last_reminder_sent_at?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          project_id: string | null
          drive_file_id: string
          name: string
          mime_type: string | null
          web_view_link: string | null
          thumbnail_link: string | null
          last_modified: string | null
          linked_by: string | null
          created_at: string
        }
        Insert: {
          org_id: string
          drive_file_id: string
          name: string
          client_id?: string | null
          project_id?: string | null
          mime_type?: string | null
          web_view_link?: string | null
          thumbnail_link?: string | null
          last_modified?: string | null
          linked_by?: string | null
        }
        Update: {
          client_id?: string | null
          project_id?: string | null
          name?: string
          mime_type?: string | null
          web_view_link?: string | null
          thumbnail_link?: string | null
          last_modified?: string | null
        }
      }
    }
  }
}
