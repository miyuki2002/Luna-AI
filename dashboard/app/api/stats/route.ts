"use server";

import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/stats";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
    return NextResponse.json(
      { message: "Không thể tải thống kê dashboard." },
      { status: 500 }
    );
  }
}
