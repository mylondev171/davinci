import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@agencycrm.app'

    // Find all flagged memberships due for a reminder (never reminded OR last reminded 15+ days ago)
    const { data: flaggedMemberships, error: fetchError } = await supabase
      .from('service_memberships')
      .select('id, org_id, service_name, service_url, cost, billing_cycle, flagged_at')
      .eq('flagged_for_removal', true)
      .or('last_reminder_sent_at.is.null,last_reminder_sent_at.lt.' + new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch flagged memberships: ${fetchError.message}`)
    }

    if (!flaggedMemberships || flaggedMemberships.length === 0) {
      return new Response(JSON.stringify({ message: 'No reminders to send', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group by org_id
    const byOrg: Record<string, typeof flaggedMemberships> = {}
    for (const m of flaggedMemberships) {
      if (!byOrg[m.org_id]) byOrg[m.org_id] = []
      byOrg[m.org_id].push(m)
    }

    let emailsSent = 0

    for (const [orgId, memberships] of Object.entries(byOrg)) {
      // Find the org owner's email
      const { data: ownerMembership } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .limit(1)
        .single()

      if (!ownerMembership) continue

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerMembership.user_id)
        .single()

      if (!ownerProfile?.email) continue

      // Get org name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      // Build email listing flagged services
      const serviceList = memberships.map((m) => {
        const costStr = m.cost != null
          ? ` — $${Number(m.cost).toFixed(2)}${m.billing_cycle ? `/${m.billing_cycle === 'monthly' ? 'mo' : 'yr'}` : ''}`
          : ''
        return `<li style="margin-bottom: 8px;"><strong>${m.service_name}</strong>${costStr}</li>`
      }).join('')

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #111; margin-bottom: 8px;">Membership Cancellation Reminder</h2>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            Hi ${ownerProfile.full_name || 'there'}, the following services in <strong>${org?.name || 'your organization'}</strong> are flagged for cancellation:
          </p>
          <ul style="color: #333; font-size: 15px; line-height: 1.6; padding-left: 20px;">
            ${serviceList}
          </ul>
          <p style="color: #555; font-size: 14px; line-height: 1.5;">
            Please review these memberships and cancel them if they are no longer needed, or unflag them in your dashboard.
          </p>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">
            You will receive this reminder every 15 days until the memberships are unflagged or deleted.
          </p>
        </div>
      `

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: ownerProfile.email,
          subject: `Reminder: ${memberships.length} ${memberships.length === 1 ? 'membership' : 'memberships'} flagged for cancellation`,
          html,
        }),
      })

      if (res.ok) {
        emailsSent++
        // Update last_reminder_sent_at for all these memberships
        const ids = memberships.map((m) => m.id)
        await supabase
          .from('service_memberships')
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .in('id', ids)
      }
    }

    return new Response(JSON.stringify({ message: 'Reminders sent', emailsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
