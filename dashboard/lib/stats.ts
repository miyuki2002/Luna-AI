import { getDb } from "./mongodb";

export interface TrendPoint {
  date: string;
  messages: number;
}

export interface TopUser {
  userId: string;
  role: string;
  daily: number;
  total: number;
}

export interface ActivityItem {
  userId: string;
  role: string;
  messages: number;
  operation: string;
  timestamp: string;
}

export interface DashboardStats {
  totals: {
    totalProfiles: number;
    totalGuilds: number;
    activeGuilds: number;
    totalMessages: number;
    consentAccepted: number;
    consentPending: number;
  };
  usage: {
    daily: number;
    weekly: number;
    monthly: number;
    total: number;
    activeUsers: number;
  };
  roleDistribution: Array<{ role: string; count: number }>;
  quota: {
    avgDailyLimit: number;
    unlimitedUsers: number;
  };
  topUsers: TopUser[];
  recentActivity: ActivityItem[];
  trend: TrendPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  const messageCollection = db.collection("user_messages");
  const profileCollection = db.collection("user_profiles");
  const guildCollection = db.collection("guild_profiles");

  const [usageDoc, roleDocs, totalProfiles, activeProfiles, totalGuilds, activeGuilds, unlimitedUsers] =
    await Promise.all([
      messageCollection
        .aggregate([
          {
            $group: {
              _id: null,
              daily: { $sum: "$messageUsage.daily" },
              weekly: { $sum: "$messageUsage.weekly" },
              monthly: { $sum: "$messageUsage.monthly" },
              total: { $sum: "$messageUsage.total" },
              activeUsers: {
                $sum: {
                  $cond: [
                    { $gt: ["$messageUsage.daily", 0] },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ])
        .next(),
      messageCollection
        .aggregate([
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 }
            }
          },
          { $project: { _id: 0, role: "$_id", count: 1 } },
          { $sort: { count: -1 } }
        ])
        .toArray(),
      profileCollection.countDocuments(),
      profileCollection.countDocuments({ "data.consent": true }),
      guildCollection.countDocuments(),
      guildCollection.countDocuments({ "xp.isActive": true }),
      messageCollection.countDocuments({ "limits.daily": -1 })
    ]);

  const avgLimitDoc = await messageCollection
    .aggregate([
      { $match: { "limits.daily": { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgDailyLimit: { $avg: "$limits.daily" }
        }
      }
    ])
    .next();

  const topUsersDocs = await messageCollection
    .find(
      {},
      {
        projection: {
          userId: 1,
          role: 1,
          "messageUsage.daily": 1,
          "messageUsage.total": 1
        }
      }
    )
    .sort({ "messageUsage.daily": -1 })
    .limit(8)
    .toArray();

  const recentActivityDocs = await messageCollection
    .aggregate([
      {
        $project: {
          userId: 1,
          role: 1,
          history: { $slice: ["$history", -8] }
        }
      },
      { $unwind: "$history" },
      { $sort: { "history.timestamp": -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          userId: 1,
          role: 1,
          messages: "$history.messages",
          operation: "$history.operation",
          timestamp: "$history.timestamp"
        }
      }
    ])
    .toArray();

  const sinceDate = new Date(Date.now() - DAY_MS * 6);
  const trendDocs = await messageCollection
    .aggregate([
      { $unwind: "$history" },
      { $match: { "history.timestamp": { $gte: sinceDate.getTime() } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $toDate: "$history.timestamp" }
            }
          },
          messages: { $sum: "$history.messages" }
        }
      },
      { $sort: { _id: 1 } }
    ])
    .toArray();

  const trend = buildTrendSeries(sinceDate, trendDocs);

  return {
    totals: {
      totalProfiles,
      totalGuilds,
      activeGuilds,
      totalMessages: usageDoc?.total ?? 0,
      consentAccepted: activeProfiles,
      consentPending: totalProfiles - activeProfiles
    },
    usage: {
      daily: usageDoc?.daily ?? 0,
      weekly: usageDoc?.weekly ?? 0,
      monthly: usageDoc?.monthly ?? 0,
      total: usageDoc?.total ?? 0,
      activeUsers: usageDoc?.activeUsers ?? 0
    },
    roleDistribution: roleDocs.map((doc) => ({
      role: doc.role ?? "unknown",
      count: doc.count ?? 0
    })),
    quota: {
      avgDailyLimit: Math.round(avgLimitDoc?.avgDailyLimit ?? 0),
      unlimitedUsers: unlimitedUsers ?? 0
    },
    topUsers: topUsersDocs.map((doc) => ({
      userId: doc.userId,
      role: doc.role ?? "user",
      daily: doc.messageUsage?.daily ?? 0,
      total: doc.messageUsage?.total ?? 0
    })),
    recentActivity: recentActivityDocs.map((doc) => ({
      userId: doc.userId,
      role: doc.role ?? "user",
      messages: doc.messages ?? 0,
      operation: doc.operation ?? "chat",
      timestamp: new Date(doc.timestamp ?? Date.now()).toISOString()
    })),
    trend
  };
}

function buildTrendSeries(since: Date, trendDocs: Array<{ _id: string; messages: number }>): TrendPoint[] {
  const map = new Map<string, number>();
  for (const doc of trendDocs) {
    map.set(doc._id, doc.messages ?? 0);
  }

  const series: TrendPoint[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(since.getTime() + DAY_MS * i);
    const key = date.toISOString().slice(0, 10);
    series.push({
      date: key,
      messages: map.get(key) ?? 0
    });
  }

  return series;
}
