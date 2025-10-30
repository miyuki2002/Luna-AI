"use client";

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DashboardStats } from "@/lib/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

const ROLE_COLORS = [
  "hsl(263.4, 70%, 50.4%)",
  "hsl(180.2, 82.6%, 51.4%)",
  "hsl(32.7, 97%, 61%)",
  "hsl(346.8, 74%, 61.5%)",
  "hsl(199, 89%, 48%)"
];

type RoleDistributionCardProps = {
  distribution: DashboardStats["roleDistribution"];
};

export function RoleDistributionCard({ distribution }: RoleDistributionCardProps) {
  const total = distribution.reduce((acc, item) => acc + item.count, 0);
  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle>Vai trò người dùng</CardTitle>
        <CardDescription>Tỷ lệ phân bổ quyền truy cập quota.</CardDescription>
      </CardHeader>
      <CardContent className="flex h-64 items-center justify-center">
        {distribution.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu nào.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                dataKey="count"
                nameKey="role"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={4}
              >
                {distribution.map((entry, index) => (
                  <Cell key={entry.role} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(15,23,42,0.9)", borderRadius: "12px", border: "1px solid rgba(14,165,233,0.3)" }}
                formatter={(value: number, _name, props) => {
                  const count = typeof value === "number" ? value : Number(value ?? 0);
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  return [`${formatNumber(count)} (${percentage}%)`, props?.payload?.role ?? "role"];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
