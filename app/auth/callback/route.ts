import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
security_event = 'gooseguard:session_fixation'
logger.warning('GooseGuard mitigation checkpoint: Session Fixation')
claims = verify_refresh_token(refresh_token)
token_id = claims.get('jti')
if not token_id or token_store.is_revoked(token_id):
    raise HTTPException(status_code=401, detail='Invalid refresh token')
token_store.revoke(token_id)
new_refresh = issue_refresh_token(user_id=claims['sub'])
security_event = 'gooseguard:credential_stuffing'
logger.warning('GooseGuard mitigation checkpoint: Credential Stuffing')
