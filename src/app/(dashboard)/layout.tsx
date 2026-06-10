import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MobileNav } from "@/components/layout/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <Topbar user={session.user as any} />
      <main className="flex-1 overflow-hidden pb-16 sm:pb-0">
        {children}
      </main>
      {/* Mobile bottom nav */}
      <MobileNav />
      {/* AI Chat FAB */}
      <ChatPanel />
    </div>
  );
}
