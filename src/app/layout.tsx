import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar — Find Your Next Role Abroad",
  description: "Personal job matching dashboard for relocation-friendly roles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
