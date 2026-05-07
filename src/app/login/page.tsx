import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-black/60">
        Google sign-in keeps it simple — no passwords to forget.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
        className="mt-8"
      >
        <button className="w-full rounded-md bg-ink px-4 py-2.5 text-white">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
