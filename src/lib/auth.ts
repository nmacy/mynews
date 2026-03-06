import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rate-limit";

/** Re-check role + username from DB at most every 5 minutes */
const ROLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        // Rate limit: 5 login attempts per minute per username
        const rl = checkRateLimit(`login:${username}`, 5, 60_000);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role, username: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as Record<string, unknown>).username as string;
        token.role = (user as Record<string, unknown>).role as string;
        token.roleCheckedAt = Date.now();
      } else if (token.id) {
        // Periodically re-validate role + username from DB
        const lastChecked = (token.roleCheckedAt as number) || 0;
        if (Date.now() - lastChecked > ROLE_REFRESH_INTERVAL_MS) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, username: true },
            });
            token.role = dbUser?.role ?? "user";
            token.username = dbUser?.username ?? (token.username as string);
            token.roleCheckedAt = Date.now();
          } catch {
            // DB query failed (transient error, hot reload, etc.)
            // Keep existing token values — don't invalidate the session
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.username = (token.username as string) || "";
        session.user.role = (token.role as string) || "user";
      }
      return session;
    },
  },
});
