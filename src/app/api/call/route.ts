import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const LK_API_KEY = process.env.LIVEKIT_API_KEY!;
const LK_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * GET /api/call?room=xxx&name=optional
 * Returns a participant token for the consumer to join a coach call.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const room = searchParams.get("room");
    if (!room) return NextResponse.json({ error: "room required" }, { status: 400 });

    const identity = `user-${user.id.slice(0, 8)}`;
    const displayName = searchParams.get("name") || user.email?.split("@")[0] || "Gebruiker";

    const at = new AccessToken(LK_API_KEY, LK_API_SECRET, {
      identity,
      name: displayName,
      ttl: "1h",
    });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();

    return NextResponse.json({ token, livekitUrl: LK_URL });
  } catch (err) {
    console.error("[Call token consumer]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
