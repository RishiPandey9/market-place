"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Client-side wrapper so the useSession() hook works in client components.
export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
