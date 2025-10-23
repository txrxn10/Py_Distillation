import { DashboardLayout } from "@/components/dashboard-layout"
import { ImageGenerationPage } from "@/components/image-generation-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function ImagePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ImageGenerationPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}