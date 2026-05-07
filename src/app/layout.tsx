import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "Paste job links, watch for changes, get pinged when something happens.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-black/10 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              jobtracker
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {session?.user ? (
                <>
                  <Link href="/dashboard" className="hover:underline">
                    Dashboard
                  </Link>
                  <Link href="/settings" className="hover:underline">
                    Settings
                  </Link>
                  <Link href="/agent" className="hover:underline">
                    Agent
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="rounded-md border px-2 py-1 hover:bg-black/5">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="rounded-md bg-ink px-3 py-1.5 text-white">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
