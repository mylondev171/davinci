'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">SEO analytics and marketing performance</p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <EmptyState
            icon={BarChart3}
            title="Reports coming soon"
            description="Connect SEMRush in Settings to view SEO analytics for your clients. Select a client to view their domain-specific reports."
          />
        </CardContent>
      </Card>
    </div>
  )
}
