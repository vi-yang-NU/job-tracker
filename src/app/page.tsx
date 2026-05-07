import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Track jobs that don't ghost you.</h1>
      <p className="mt-4 text-lg text-black/70">
        Paste job links into portfolios. We watch them every few hours, alert you to deadlines,
        flag postings that disappear, and surface similar roles when they do.
      </p>
      <ul className="mt-6 space-y-2 text-black/70">
        <li>– Multiple portfolios with their own location preferences</li>
        <li>– Map view so you can scan roles by city</li>
        <li>– Optional Mac agent sends you an iMessage every morning</li>
      </ul>
      <Link
        href="/login"
        className="mt-8 inline-block rounded-md bg-ink px-5 py-2.5 text-white"
      >
        Sign in with Google
      </Link>
    </div>
  );
}
