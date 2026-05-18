import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/groups");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Accountably</h1>
        <p className="mt-2 text-zinc-600">Group pacts with your friends.</p>
      </div>
      <a
        href="/login"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Get started
      </a>
    </main>
  );
}
