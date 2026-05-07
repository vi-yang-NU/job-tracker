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
        <header className="sticky top-0 z-30 border-b border-black/10 bg-white/70 backdrop-blur transition-shadow duration-200 supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 text-lg font-semibold transition-colors duration-150 hover:text-accent"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-accent transition-transform duration-200 group-hover:scale-125" />
              jobtracker
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {session?.user ? (
                <>
                  <NavLink href="/dashboard">Dashboard</NavLink>
                  <NavLink href="/settings">Settings</NavLink>
                  <NavLink href="/agent">Agent</NavLink>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="btn-ghost ml-1">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn-primary px-3 py-1.5">
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-black/70 transition-colors duration-150 hover:bg-black/5 hover:text-black"
    >
      {children}
    </Link>
  );
}
