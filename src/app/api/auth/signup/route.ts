import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// 3 signups per hour per IP
const SIGNUP_LIMIT = 3;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password, name, email } = body as {
    username?: string;
    password?: string;
    name?: string;
    email?: string;
  };

  if (
    !username ||
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 30 ||
    !USERNAME_RE.test(username)
  ) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters (letters, numbers, _ or -)" },
      { status: 400 }
    );
  }

  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be 8–128 characters" },
      { status: 400 }
    );
  }

  if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (name && (typeof name !== "string" || name.length > 100)) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { username } });
      if (existing) {
        throw new Error("USERNAME_TAKEN");
      }

      const userCount = await tx.user.count();
      const role = userCount === 0 ? "admin" : "user";

      return tx.user.create({
        data: {
          username,
          hashedPassword,
          name: name || null,
          email: email || null,
          role,
          settings: { create: {} },
        },
      });
    });

    return NextResponse.json({ id: user.id, username: user.username }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    throw err;
  }
}
