import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";
import { sendApnsPush, isApnsConfigured } from "@/lib/apns";
import { createServiceRoleClient } from "@/lib/supabase/server";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * POST /api/push/call-notify
 * Called by B2B app when a coach starts a video call.
 * Sends web push + iOS APNs to the consumer user.
 *
 * Headers: x-internal-secret: <shared secret>
 * Body: { user_id: string, caller_name: string }
 */
export async function POST(req: NextRequest) {
  // Verify internal secret
  const secret = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { user_id, caller_name } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const title = "📞 Inkomend gesprek";
    const body = `${caller_name || "Je coach"} wil videobellen`;
    const url = "/hulp";

    let webSent = 0;
    let iosSent = 0;

    // Web Push (VAPID)
    try {
      webSent = await sendPushToUser(user_id, { title, body, url, tag: "paywatch-call" });
    } catch (err) {
      console.error("[Call notify] Web push error:", err);
    }

    // iOS APNs
    if (isApnsConfigured()) {
      try {
        const supabase = createServiceRoleClient();
        const { data: tokens } = await supabase
          .from("native_push_tokens")
          .select("token, platform")
          .eq("user_id", user_id);

        if (tokens && tokens.length > 0) {
          const sandbox = process.env.APNS_SANDBOX === "true";
          for (const t of tokens) {
            if (t.platform === "ios") {
              const result = await sendApnsPush(t.token, { title, body, url, badge: 1 }, sandbox);
              if (result.ok) {
                iosSent++;
              } else if ("unregistered" in result && result.unregistered) {
                await supabase.from("native_push_tokens").delete().eq("token", t.token);
              }
            }
          }
        }
      } catch (err) {
        console.error("[Call notify] APNs error:", err);
      }
    }

    console.log(`[Call notify] user=${user_id} web=${webSent} ios=${iosSent}`);
    return NextResponse.json({ sent: webSent + iosSent, web: webSent, ios: iosSent });
  } catch (err) {
    console.error("[Call notify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
