import { Suspense } from "react";
import { getDashboardStats } from "@/lib/stats";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

async function DashboardView() {
  const initialData = await getDashboardStats();
  return <DashboardClient initialData={initialData} />;
}

export default async function Page() {
  return (
    <main className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute left-[10%] top-[40%] h-[280px] w-[280px] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[10%] top-[65%] h-[320px] w-[320px] rounded-full bg-indigo-500/25 blur-3xl" />
      </div>
      <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Đang tải dữ liệu dashboard...</div>}>
        {/* @ts-expect-error Async Server Component */}
        <DashboardView />
      </Suspense>
    </main>
  );
}
