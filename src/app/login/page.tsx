import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; next?: string }>;
}) {
  const { error, mode, next } = await searchParams;
  const isSignup = mode === "signup";
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  const toggleHref = isSignup
    ? `/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`
    : `/login?mode=signup${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {isSignup
              ? "Sign up to start a group pact with your friends."
              : "Log in to your accountability groups."}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="space-y-3">
          {safeNext && <input type="hidden" name="next" value={safeNext} />}
          {isSignup && (
            <label className="block">
              <span className="text-sm font-medium">Display name</span>
              <input
                name="display_name"
                type="text"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            formAction={isSignup ? signup : login}
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <a href={toggleHref} className="font-medium text-black underline">
                Log in
              </a>
            </>
          ) : (
            <>
              No account?{" "}
              <a href={toggleHref} className="font-medium text-black underline">
                Sign up
              </a>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
