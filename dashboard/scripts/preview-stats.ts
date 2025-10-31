import "dotenv/config";

import { getDashboardStats } from "../lib/stats";

async function main() {
  try {
    const stats = await getDashboardStats();
    console.log("Luna Dashboard Preview");
    console.log("Profiles:", stats.totals.totalProfiles);
    console.log("Guilds:", stats.totals.totalGuilds);
    console.log("Consent accepted:", stats.totals.consentAccepted);
    console.log("Usage today:", stats.usage.daily);
    console.log("Active users today:", stats.usage.activeUsers);
    console.log("Average daily quota:", stats.quota.avgDailyLimit);
    console.log("Top users today:", stats.topUsers.slice(0, 3));
    process.exit(0);
  } catch (error) {
    console.error("Failed to preview stats:", error);
    process.exit(1);
  }
}

void main();
