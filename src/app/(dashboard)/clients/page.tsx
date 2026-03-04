import { ClientList } from '@/components/clients/client-list'

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-muted-foreground">Manage your client relationships</p>
      </div>
      <ClientList />
    </div>
  )
}
