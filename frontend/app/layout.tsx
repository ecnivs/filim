"use client";

import "./globals.css";
import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeviceProvider } from "@/lib/device-context";
import { LayoutShell } from "@/components/LayoutShell";

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen">
        {mounted && (
          <QueryClientProvider client={queryClient}>
            <DeviceProvider>
              <LayoutShell>{children}</LayoutShell>
            </DeviceProvider>
          </QueryClientProvider>
        )}
      </body>
    </html>
  );
}

