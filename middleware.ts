import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
claims = jwt.decode(
    token,
    key=JWT_PUBLIC_KEY,
    algorithms=['RS256'],
    options={'require': ['exp', 'iat', 'sub']},
)
if claims.get('iss') != JWT_ISSUER:
    raise HTTPException(status_code=401, detail='Invalid token issuer')
