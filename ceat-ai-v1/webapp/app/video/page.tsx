import { DashboardLayout } from "@/components/dashboard-layout"
import { VideoGenerationPage } from "@/components/video-generation-page"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function VideoPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <VideoGenerationPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
