import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { encrypt, maskKey, decrypt } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const keys = await prisma.serverApiKey.findMany({
    select: {
      provider: true,
      model: true,
      enabled: true,
      encryptedKey: true,
      iv: true,
      authTag: true,
    },
  });

  return NextResponse.json(
    keys.map((k) => {
      let masked = "****";
      try {
        const plain = decrypt(k.encryptedKey, k.iv, k.authTag);
        masked = maskKey(plain);
      } catch {
        // decryption failed
      }
      return {
        provider: k.provider,
        model: k.model,
        enabled: k.enabled,
        maskedKey: masked,
      };
    })
  );
}

export async function POST(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, apiKey, model, enabled } = body as {
    provider?: string;
    apiKey?: string;
    model?: string;
    enabled?: boolean;
  };

  if (!provider || typeof provider !== "string") {
    return NextResponse.json({ error: "Provider is required" }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  if (!model || typeof model !== "string") {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }

  const { ciphertext, iv, authTag } = encrypt(apiKey);

  await prisma.serverApiKey.upsert({
    where: { provider },
    create: {
      provider,
      encryptedKey: ciphertext,
      iv,
      authTag,
      model,
      enabled: enabled ?? true,
    },
    update: {
      encryptedKey: ciphertext,
      iv,
      authTag,
      model,
      enabled: enabled ?? true,
    },
  });

  return NextResponse.json({ ok: true, maskedKey: maskKey(apiKey) });
}

export async function DELETE(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "Provider query param required" }, { status: 400 });
  }

  await prisma.serverApiKey.deleteMany({ where: { provider } });

  return NextResponse.json({ ok: true });
}
