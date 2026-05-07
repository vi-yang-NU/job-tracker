import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <div className="animate-rise rounded-2xl border border-black/10 bg-white p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-center text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-center text-sm text-black/60">
          Google sign-in keeps it simple — no passwords to forget.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
          className="mt-8"
        >
          <button className="btn-primary group w-full py-2.5">
            <GoogleMark />
            <span className="ml-2">Continue with Google</span>
            <span className="ml-1 inline-block transition-transform duration-150 group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.1 29.1 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5 0 9.6-1.9 13.1-5l-6-5.1c-2 1.4-4.5 2.3-7.1 2.3-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.4 39.6 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6 5.1c4.2-3.9 6.9-9.6 6.9-15.4 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
