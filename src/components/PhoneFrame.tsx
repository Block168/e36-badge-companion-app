import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function PhoneFrame({ children, theme }: { children: ReactNode; theme: "dark" | "light" }) {
  return (
    <div className={cn("relative mx-auto h-[820px] w-[390px] max-w-full rounded-[52px] border-[6px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]", theme === "dark" ? "border-zinc-800 bg-black ring-1 ring-white/10" : "border-slate-300 bg-slate-100 ring-1 ring-slate-400")}>
      <div className={cn("absolute left-1/2 top-0 z-20 h-7 w-36 -translate-x-1/2 rounded-b-2xl", theme === "dark" ? "bg-black" : "bg-slate-200")} />
      <div className={cn("relative h-full w-full overflow-hidden rounded-[46px]", theme === "dark" ? "bg-zinc-950" : "bg-white")}>
        {children}
      </div>
      <div className={cn("absolute left-1/2 bottom-1.5 h-1 w-32 -translate-x-1/2 rounded-full", theme === "dark" ? "bg-zinc-700" : "bg-slate-300")} />
    </div>
  );
}
