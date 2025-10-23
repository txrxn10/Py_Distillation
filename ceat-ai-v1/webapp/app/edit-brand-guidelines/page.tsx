import { DashboardLayout } from "@/components/dashboard-layout"
import EditBrandGuidelinesPage from "@/components/edit-brand-guidelines";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function Page() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <EditBrandGuidelinesPage />
      </DashboardLayout>
    </ProtectedRoute>
  )
}


export const metadata = {
  title: "Edit Brand Guidelines",
  description: "Manage brand guidelines for image and video generation",
};