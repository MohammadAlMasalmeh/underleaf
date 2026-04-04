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
const publicKey = import.meta.env.VITE_PUBLIC_API_KEY
if (!publicKey) throw new Error('Missing VITE_PUBLIC_API_KEY')
export const API_KEY = publicKey
