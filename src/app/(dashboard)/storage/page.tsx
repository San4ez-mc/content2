import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Сховище" };

export default async function StoragePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-40px)] text-center p-8">
      <div className="text-6xl mb-4">🗄️</div>
      <h2 className="text-lg font-semibold text-fg mb-2">Медіасховище</h2>
      <p className="text-sm text-fg-muted max-w-sm">
        Завантаження, організація та пошук медіафайлів. Grid/List перегляд, папки, теги, drag & drop upload.
      </p>
      <div className="mt-4 px-3 py-1.5 bg-warn/10 border border-warn/30 rounded-lg">
        <p className="text-xs text-warn font-medium">⏳ В розробці — Фаза 4</p>
      </div>
    </div>
  );
}
