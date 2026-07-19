import { SiteHeader } from "@/components/nav/SiteHeader";
import { SiteFooter } from "@/components/nav/SiteFooter";

// Shared shell for all (dashboard) pages: a consistent header with search,
// category nav, and session-aware actions. Individual pages render their own
// <main> content beneath it.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
