"use client";

import { Activity, Clock, Gauge, MessageCircle } from "lucide-react";
import { DashboardStats } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatsOverviewProps = {
  usage: DashboardStats["usage"];
  quota: DashboardStats["quota"];
};

const overviewConfig = [
  {
    key: "daily",
    label: "Thông điệp hôm nay",
    icon: MessageCircle,
    description: "Tổng số request Luna đã xử lý trong 24h qua."
  },
  {
    key: "weekly",
    label: "Khối lượng 7 ngày",
    icon: Activity,
    description: "Tổng số request trong tuần này."
  },
  {
    key: "activeUsers",
    label: "Người dùng hoạt động",
    icon: Clock,
    description: "Người đã sử dụng Luna trong 24h gần nhất."
  }
] as const;

export function StatsOverview({ usage, quota }: StatsOverviewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {overviewConfig.map((item) => (
        <Card key={item.key} className="bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(usage[item.key])}</div>
            <CardDescription>{item.description}</CardDescription>
          </CardContent>
        </Card>
      ))}

      <Card className="bg-card/70">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quota trung bình</CardTitle>
          <Gauge className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(quota.avgDailyLimit)}</div>
          <CardDescription>
            Giới hạn trong ngày (không bao gồm owner). Người không giới hạn:{" "}
            <span className="font-semibold text-foreground">{formatNumber(quota.unlimitedUsers)}</span>
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
