import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Типи контенту" };

export default async function ContentTypesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-40px)] text-center p-8">
      <div className="text-6xl mb-4">📝</div>
      <h2 className="text-lg font-semibold text-fg mb-2">Типи контенту</h2>
      <p className="text-sm text-fg-muted max-w-sm">
        Шаблони постів з промптами для AI-генерації. Кожен тип — це готова інструкція для бота: яким тоном, структурою та CTA писати.
      </p>
      <div className="mt-4 px-3 py-1.5 bg-warn/10 border border-warn/30 rounded-lg">
        <p className="text-xs text-warn font-medium">⏳ В розробці — Фаза 3</p>
      </div>
    </div>
  );
}
