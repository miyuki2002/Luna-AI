"use client";

import { memo } from "react";
import { RocketIcon, RefreshCcw } from "lucide-react";
import { DashboardStats } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HeroHeaderProps = {
  totals: DashboardStats["totals"];
  refreshing: boolean;
  onRefresh: () => void;
};

export const HeroHeader = memo(function HeroHeader({
  totals,
  refreshing,
  onRefresh
}: HeroHeaderProps) {
  return (
    <header className="flex flex-col gap-6 rounded-3xl border border-border/60 bg-gradient-to-br from-slate-900/60 via-slate-900/30 to-slate-900/60 p-8 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit bg-primary/10 text-primary">
            <RocketIcon className="mr-2 h-4 w-4" />
            Luna Control Center
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Welcome back, Captain!
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Theo dõi tình trạng hoạt động của Luna AI, kiểm soát quota và hiểu rõ cách người dùng đang tương tác.
            Dashboard làm mới mỗi phút hoặc bạn có thể cập nhật thủ công bất kỳ lúc nào.
          </p>
        </div>
        <Button
          onClick={onRefresh}
          variant="outline"
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          disabled={refreshing}
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Làm mới dữ liệu
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroMetric label="Người dùng" value={totals.totalProfiles} />
        <HeroMetric label="Guild hoạt động" value={totals.activeGuilds} suffix={`/${formatNumber(totals.totalGuilds)}`} />
        <HeroMetric label="Thông điệp xử lý" value={totals.totalMessages} />
        <HeroMetric
          label="Chấp thuận consent"
          value={totals.consentAccepted}
          suffix={`/${formatNumber(totals.consentPending + totals.consentAccepted)}`}
        />
      </div>
    </header>
  );
});

type HeroMetricProps = {
  label: string;
  value: number;
  suffix?: string;
};

function HeroMetric({ label, value, suffix }: HeroMetricProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
      <span className="text-sm uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-2xl font-semibold text-foreground">
        {formatNumber(value)}
        {suffix ? <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}
