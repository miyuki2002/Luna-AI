"use client";

import { Activity } from "lucide-react";
import { DashboardStats } from "@/lib/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatRelativeTime } from "@/lib/utils";

type RecentActivityCardProps = {
  activities: DashboardStats["recentActivity"];
};

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle>Hoạt động gần đây</CardTitle>
        <CardDescription>10 thao tác cuối cùng Luna đã ghi nhận trong lịch sử quota.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có log nào gần đây.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li
                key={`${activity.userId}-${activity.timestamp}`}
                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-foreground">
                    ID {activity.userId} • {activity.operation}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(activity.messages)} messages • {formatRelativeTime(new Date(activity.timestamp))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
