import { DashboardLayout } from "@/components/dashboard-layout"
import { VirtualTryOnPage } from "@/components/virtual-try-on-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function TryOnPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <VirtualTryOnPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
