"use client";

import { Crown, Shield } from "lucide-react";
import { DashboardStats } from "@/lib/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

type TopUsersCardProps = {
  topUsers: DashboardStats["topUsers"];
};

const ROLE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" }> = {
  owner: { label: "Owner", variant: "success" },
  admin: { label: "Admin", variant: "default" },
  helper: { label: "Helper", variant: "secondary" },
  user: { label: "User", variant: "outline" }
};

export function TopUsersCard({ topUsers }: TopUsersCardProps) {
  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle>Người dùng tích cực</CardTitle>
        <CardDescription>Top 8 người dùng có lượng message cao nhất hôm nay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có người dùng nào tương tác.</p>
        ) : (
          <div className="space-y-3">
            {topUsers.map((user, index) => {
              const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.user;
              const isLeader = index === 0;
              return (
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 shadow-sm transition hover:border-primary/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {isLeader ? <Crown className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">ID: {user.userId}</p>
                      <p className="text-xs text-muted-foreground">Tổng: {formatNumber(user.total)} messages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{formatNumber(user.daily)} hôm nay</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
