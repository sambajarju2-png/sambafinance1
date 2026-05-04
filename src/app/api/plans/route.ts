import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = createServiceRoleClient();
  const { data: plans } = await supabase.from('plan_rules').select('*').order('id');
  return NextResponse.json({ plans: plans || [] });
}
