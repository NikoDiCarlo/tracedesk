import type {
  Metadata,
  Viewport
} from "next";

import "./globals.css";

export const metadata: Metadata = {
  title:
    "TraceDesk — Agent-native incident response",

  description:
    "AI-powered incident response where humans and agents investigate outages together through WebMCP.",

  applicationName:
    "TraceDesk",

  icons: {
    icon: "/favicon.ico"
  },

  openGraph: {
    title: "TraceDesk",

    description:
      "Agent-native incident response built for humans and AI agents.",

    type: "website"
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#06183A"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
