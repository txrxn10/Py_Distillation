import { DashboardLayout } from "@/components/dashboard-layout"
import EditImagePage from "@/components/edit-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function EditImage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <EditImagePage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
