import type { ReactNode } from "react";

export default function MissionViewLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "black" }}>
      {children}
    </div>
  );
}
