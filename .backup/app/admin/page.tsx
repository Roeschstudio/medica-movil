import { AdminGuard } from "@/components/admin/admin-guard";
import AdminDashboardClient from "./admin-dashboard-client";

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      <AdminDashboardClient />
    </AdminGuard>
  );
}
