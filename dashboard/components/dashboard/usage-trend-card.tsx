"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardStats } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UsageTrendCardProps = {
  trend: DashboardStats["trend"];
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit"
});

export function UsageTrendCard({ trend }: UsageTrendCardProps) {
  return (
    <Card className="col-span-1 bg-card/70">
      <CardHeader className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Xu hướng sử dụng</CardTitle>
          <CardDescription>Lượng request được xử lý trong 7 ngày gần nhất.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(263.4, 70%, 50.4%)" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(263.4, 70%, 50.4%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(value) => dateFormatter.format(new Date(value))}
              tick={{ fill: "rgba(226,232,240,0.6)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={80}
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fill: "rgba(226,232,240,0.6)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={false}
              contentStyle={{ backgroundColor: "rgba(15,23,42,0.9)", borderRadius: "12px", border: "1px solid rgba(99,102,241,0.3)" }}
              labelFormatter={(label) => dateFormatter.format(new Date(label))}
              formatter={(value: number) => [formatNumber(value), "Messages"]}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="hsl(263.4, 70%, 50.4%)"
              fill="url(#trendGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
