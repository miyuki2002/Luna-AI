"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { DashboardStats } from "@/lib/stats";
import { HeroHeader } from "@/components/dashboard/hero-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { UsageTrendCard } from "@/components/dashboard/usage-trend-card";
import { RoleDistributionCard } from "@/components/dashboard/role-distribution-card";
import { TopUsersCard } from "@/components/dashboard/top-users-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";

type DashboardClientProps = {
  initialData: DashboardStats;
};

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error("Không thể tải dữ liệu dashboard");
  }
  return res.json();
});

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { data, isValidating, mutate } = useSWR<DashboardStats>("/api/stats", fetcher, {
    fallbackData: initialData,
    refreshInterval: 60_000,
    revalidateOnFocus: true
  });

  const handleManualRefresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  const stats = data ?? initialData;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-6 md:px-6">
      <HeroHeader totals={stats.totals} refreshing={isValidating} onRefresh={handleManualRefresh} />
      <StatsOverview usage={stats.usage} quota={stats.quota} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <UsageTrendCard trend={stats.trend} />
        <RoleDistributionCard distribution={stats.roleDistribution} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <TopUsersCard topUsers={stats.topUsers} />
        <RecentActivityCard activities={stats.recentActivity} />
      </div>
    </div>
  );
}
