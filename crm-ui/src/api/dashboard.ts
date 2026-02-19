import { http } from "./http";

export interface DashboardStats {
  totalCustomers: number;
  activeOpportunities: number;
  totalForecastAmount: number;
  wonDealsThisMonth: number;
}

export interface StageStat {
  stage: string;
  count: number;
  totalAmount: number;
}

export interface RecentDeal {
  id: number;
  name: string;
  amount: number;
  customerName: string;
  closeDate: string;
}

export async function fetchDashboardStats() {
  const res = await http.get<DashboardStats>("/Dashboard/stats");
  return res.data;
}

export async function fetchFunnelData() {
  const res = await http.get<StageStat[]>("/Dashboard/funnel");
  return res.data;
}

export async function fetchRecentWonDeals() {
  const res = await http.get<RecentDeal[]>("/Dashboard/recent-won");
  return res.data;
}