// src/app/integrations/reddit/page.tsx
import Link from "next/link";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}

export default function RedditIntegrationPage({ searchParams }: Props) {
  const connected = searchParams.connected === "1";
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const name = typeof searchParams.name === "string" ? searchParams.name : undefined;

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Reddit integration</h1>

      {connected ? (
        <div className="rounded-2xl border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge label="Connected" />
            {name ? <span className="text-sm text-gray-600">u/{name}</span> : null}
          </div>
          <p className="text-sm">
            Your Reddit account is connected. You can revoke access anytime from your Reddit
            app settings.
          </p>
          <div className="pt-2">
            <Link href="/dashboard" className="underline">
              Go to dashboard
            </Link>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge label="Error" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
          <p className="text-sm">The Reddit OAuth flow failed. Try again.</p>
          <div className="pt-2">
            <Link href="/api/auth/reddit/start" className="underline">
              Start Reddit connection
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border p-4 space-y-2">
          <Badge label="Idle" />
          <p className="text-sm">Connect your Reddit account to proceed.</p>
          <div className="pt-2">
            <Link href="/api/auth/reddit/start" className="underline">
              Start Reddit connection
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
