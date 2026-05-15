import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * DELETE /api/bank/transactions/[id]
 * Delete a single bank transaction from the user's overview.
 * Privacy right: users can remove individual transactions they don't
 * want visible in their PayWatch account.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await params;
    const cookieHeader = req.headers.get("cookie");
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return [];
            return cookieHeader.split(";").map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

    // RLS ensures user can only delete their own transactions
    const { error } = await supabase
      .from("bank_transactions")
      .delete()
      .eq("id", txId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Bank tx delete]", error);
      return NextResponse.json(
        { error: "Kon transactie niet verwijderen" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Bank tx delete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
