import { getStaffSession } from "@/lib/admin-session";
import { getRoleName } from "@/lib/roles";
import AdminSessionProvider from "@/components/shared/admin-session-provider";
import QueryProvider from "@/components/shared/query-provider";
import DashboardSidebar from "@/modules/dashboard/components/dashboard-sidebar";
import { redirect } from "next/navigation";

export const instant = false;

// Staff pages are private: keep them out of search results.
export const metadata = { title: "Staff dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const access = await getStaffSession();
  if (!access.session) {
    redirect(access.status === 401 ? "/login" : "/login?access=denied");
  }

  const identity = {
    name: access.session.user.name,
    email: access.session.user.email,
    role: access.role ?? "user",
    roleName: await getRoleName(access.role ?? "user"),
    permissions: access.permissions,
  };
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(now);

  return (
    <AdminSessionProvider
      user={identity}
      todayLabel={todayLabel}
      now={now.toISOString()}
    >
      <QueryProvider>
        <div className="admin-shell" lang="en">
          <DashboardSidebar user={identity} />
          {children}
        </div>
      </QueryProvider>
    </AdminSessionProvider>
  );
}
