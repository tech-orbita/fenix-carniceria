import { createBrowserClient } from "@supabase/ssr";

import { sessionCookieOptions } from "./config";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: sessionCookieOptions },
  );
}
