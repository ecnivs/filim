import "./globals.css";
import { ReactNode } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { ClientProviders } from "@/components/ClientProviders";

export default function RootLayout({
    children,
    modal
}: {
    children: ReactNode;
    modal: ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-background text-foreground min-h-screen antialiased">
                <ClientProviders>
                    <LayoutShell>
                        {children}
                    </LayoutShell>
                    {modal}
                </ClientProviders>
            </body>
        </html>
    );
}

