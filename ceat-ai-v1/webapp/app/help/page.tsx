import { DashboardLayout } from "@/components/dashboard-layout"
import { HelpPage } from "@/components/help-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function Help() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <HelpPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
