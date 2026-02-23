import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar 🎯",
  description: "Frontend developer jobs with visa sponsorship",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
