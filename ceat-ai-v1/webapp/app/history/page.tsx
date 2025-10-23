import { DashboardLayout } from "@/components/dashboard-layout"
import { HistoryPage } from "@/components/history-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function History() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <HistoryPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
