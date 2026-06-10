import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "CP2 — Content Platform",
    template: "%s | CP2",
  },
  description: "Управління контентом для соціальних мереж",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className="dark">
      <body className="bg-canvas text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
