"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ConfirmDialogProvider } from "./confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <SessionProvider>
      <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
    </SessionProvider>
  );
}
