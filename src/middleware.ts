import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/((?!login|forgot-password|reset-password|invite|api/auth|api/webhooks|api/posts/bulk-import|api/posts/fill-skeletons|api/invite|api/sse|api/tools/for-bot|api/agent-tools|api/scheduler|api/generation-watchdog|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
