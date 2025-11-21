"use client";

import { UnifiedAuthProvider } from "@/lib/unified-auth-context";
import { UnifiedRealtimeProvider } from "@/lib/unified-realtime-context";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <UnifiedAuthProvider>
        <UnifiedRealtimeProvider>{children}</UnifiedRealtimeProvider>
      </UnifiedAuthProvider>
    </SessionProvider>
  );
}
