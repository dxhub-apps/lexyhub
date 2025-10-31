import { ReactNode } from "react";

import { EditingNav } from "@/components/editing/EditingNav";

export default function EditingLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="editing-layout">
      <header className="editing-hero surface-card">
        <div>
          <h1>Etsy editing suite</h1>
          <p>
            Score listings, track competitors, and repair tag health without leaving the Lexy editing workspace. The tools below are
            wired into Supabase so audit history and insights stay audit-ready.
          </p>
        </div>
      </header>
      <EditingNav />
      <div className="editing-content">{children}</div>
    </div>
  );
}
