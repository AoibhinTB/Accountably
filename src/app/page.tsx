import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/feed");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="m-0" style={{ lineHeight: 0 }}>
          <span className="sr-only">Accountably</span>
          <Image
            src="/wordmark.png"
            alt=""
            width={800}
            height={228}
            priority
            style={{ width: "100%", height: "auto", maxWidth: 320 }}
          />
        </h1>
        <p
          className="mt-4"
          style={{ color: "var(--ink-soft)", fontSize: 18, lineHeight: 1.35 }}
        >
          group pacts with your friends.
        </p>
      </div>
      <a
        href="/login"
        className="press inline-flex items-center justify-center"
        style={{
          minHeight: 56,
          padding: "0 28px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          color: "#fff",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 17,
        }}
      >
        get started →
      </a>
    </main>
  );
}
