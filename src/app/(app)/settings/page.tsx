"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SettingsPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-none">Settings</h1>
        <p className="mt-2 text-sm text-foreground">Manage your workspace preferences and notification controls.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-base font-semibold">Notifications</h2>
          <p className="mt-2 text-sm">Control LexyHub banner and email alerts.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/settings/notifications">Open</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
