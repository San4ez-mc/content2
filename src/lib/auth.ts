import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SSO_URL = process.env.SSO_URL || "http://localhost:4600";

// FINEKO SSO як кастомний OAuth-провайдер (#284). Працює поряд з Credentials —
// поточний вхід email/пароль не ламається; додається кнопка "Увійти через FINEKO".
const finekoSSO: OAuthConfig<any> = {
  id: "fineko-sso",
  name: "FINEKO SSO",
  type: "oauth",
  clientId: process.env.SSO_CLIENT_ID,
  clientSecret: process.env.SSO_CLIENT_SECRET,
  checks: ["state"], // SSO не підтримує PKCE — лише state
  authorization: { url: `${SSO_URL}/authorize`, params: { response_type: "code" } },
  token: `${SSO_URL}/oauth/token`,
  userinfo: `${SSO_URL}/me`,
  client: { token_endpoint_auth_method: "client_secret_post" },
  profile(profile) {
    const u = profile?.user ?? profile; // /me віддає { user: {...} }
    return {
      id: String(u.id),
      email: u.email,
      name: u.displayName ?? u.name ?? u.email,
      role: "user",
    };
  },
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    finekoSSO,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    // Вхід через SSO: створюємо/знаходимо локального юзера content2 за email.
    async signIn({ user, account }) {
      if (account?.provider === "fineko-sso" && user?.email) {
        const email = user.email.toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email,
              name: user.name || email,
              passwordHash: "sso:managed", // вхід за паролем неможливий — тільки через SSO
              role: "client",
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Для будь-якого входу беремо канонічні id/role з БД за email.
      if (user?.email || account) {
        const email = (user?.email || (token.email as string) || "").toLowerCase();
        if (email) {
          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.email = dbUser.email;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
};
