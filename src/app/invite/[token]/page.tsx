import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Запрошення" };

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invitation = await prisma.invitation.findUnique({
    where: { token: params.token },
    include: { project: true },
  });

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-lg font-semibold text-fg mb-2">Посилання недійсне</h2>
          <p className="text-sm text-fg-muted">Це запрошення не існує або вже використане.</p>
        </div>
      </div>
    );
  }

  if (invitation.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-fg mb-2">Запрошення вже використано</h2>
          <p className="text-sm text-fg-muted">Увійдіть з вашими даними.</p>
          <a href="/login" className="mt-4 inline-block btn-primary text-xs px-4 py-2">Увійти</a>
        </div>
      </div>
    );
  }

  if (new Date() > invitation.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-lg font-semibold text-fg mb-2">Запрошення застаріло</h2>
          <p className="text-sm text-fg-muted">Зверніться до адміністратора для нового запрошення.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <InviteForm token={params.token} email={invitation.email} projectName={invitation.project.name} />
    </div>
  );
}
