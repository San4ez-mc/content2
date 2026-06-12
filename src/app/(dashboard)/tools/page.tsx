import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ToolsView } from "@/components/tools/ToolsView";

export const metadata = { title: "Воронки генерації" };

export default async function ToolsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <ToolsView />;
}
