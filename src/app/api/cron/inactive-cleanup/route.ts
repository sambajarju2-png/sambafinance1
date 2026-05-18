import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/inactive-cleanup
 * GDPR Art. 5(1)(e) — Storage Limitation
 * 
 * - 22 months inactive: sends warning email
 * - 24 months inactive: calls delete_all_user_data()
 * 
 * "Inactive" = no last_active_at update for N months
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceRoleClient();

  const now = new Date();
  const warningCutoff = new Date(now);
  warningCutoff.setMonth(warningCutoff.getMonth() - 22);
  const deletionCutoff = new Date(now);
  deletionCutoff.setMonth(deletionCutoff.getMonth() - 24);

  // 1. Find accounts inactive 24+ months → delete
  const { data: toDelete } = await supabase
    .from("user_settings")
    .select("user_id")
    .lt("last_active_at", deletionCutoff.toISOString())
    .not("last_active_at", "is", null);

  let deleted = 0;
  for (const row of toDelete || []) {
    try {
      await supabase.rpc("delete_all_user_data", { target_user_id: row.user_id });
      await supabase.auth.admin.deleteUser(row.user_id);
      deleted++;
    } catch (err) {
      console.error(`[Inactive cleanup] Delete failed for ${row.user_id}:`, err);
    }
  }

  // 2. Find accounts inactive 22-24 months → warn (only if not already warned)
  const { data: toWarn } = await supabase
    .from("user_settings")
    .select("user_id")
    .lt("last_active_at", warningCutoff.toISOString())
    .gte("last_active_at", deletionCutoff.toISOString())
    .not("last_active_at", "is", null)
    .is("inactive_warning_sent", null);

  let warned = 0;
  if (toWarn && toWarn.length > 0 && process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const row of toWarn) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
        const email = authUser?.user?.email;
        if (!email) continue;

        await resend.emails.send({
          from: "PayWatch <noreply@paywatch.app>",
          to: [email],
          subject: "Je PayWatch-account wordt binnenkort verwijderd",
          html: `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:32px">
            <p style="font-size:12px;font-weight:800;color:#0A2540">PayWatch</p>
            <p style="font-size:14px;color:#0A2540;line-height:1.7;margin-top:16px">Je PayWatch-account is langer dan 22 maanden niet gebruikt. Conform ons privacybeleid verwijderen wij inactieve accounts automatisch na 24 maanden.</p>
            <p style="font-size:14px;color:#0A2540;line-height:1.7"><strong>Log binnen 2 maanden in om je account te behouden.</strong></p>
            <a href="https://app.paywatch.app" style="display:inline-block;padding:12px 24px;background:#2563EB;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;margin-top:8px">Inloggen bij PayWatch</a>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
            <p style="font-size:11px;color:#94A3B8">Dit bericht is verstuurd conform Art. 5(1)(e) AVG (opslagbeperking).</p>
          </div>`,
        });

        await supabase.from("user_settings")
          .update({ inactive_warning_sent: now.toISOString() })
          .eq("user_id", row.user_id);
        warned++;
      } catch (err) {
        console.error(`[Inactive cleanup] Warn failed for ${row.user_id}:`, err);
      }
    }
  }

  console.log(`[Inactive cleanup] Deleted: ${deleted}, Warned: ${warned}`);
  return NextResponse.json({ ok: true, deleted, warned });
}
