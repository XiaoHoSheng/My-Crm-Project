import { http } from "./http";

export interface Opportunity {
  id: number;
  name: string;
  amount: number;
  stage: string;
  closingDate?: string;
  description?: string;
  customerId?: number;
  customerName?: string;
}

export const STAGES = ["New", "Discovery", "Proposal", "Negotiation", "Won", "Lost"];

// 获取所有商机
export async function fetchOpportunities() {
  const res = await http.get<Opportunity[]>("/Opportunities");
  return res.data;
}

// ✅ 新增：获取指定客户的商机
export async function fetchOpportunitiesByCustomerId(customerId: number | string) {
  const res = await http.get<Opportunity[]>(`/Opportunities/ByCustomer/${customerId}`);
  return res.data;
}

// 新增
export async function createOpportunity(data: Partial<Opportunity>) {
  return http.post("/Opportunities", data);
}

// 更新
export async function updateOpportunity(id: number, data: Partial<Opportunity>) {
  return http.put(`/Opportunities/${id}`, data);
}

// 更新阶段
export async function updateOpportunityStage(id: number, stage: string) {
  return http.put(`/Opportunities/${id}/stage`, JSON.stringify(stage), {
    headers: { "Content-Type": "application/json" },
  });
}

// 删除
export async function deleteOpportunity(id: number) {
  return http.delete(`/Opportunities/${id}`);
}