// src/api/customers.ts
import { http } from "./http";

// =========================
// Types
// =========================
export type ListResult<T> = { total: number; items: T[] };

export type FetchCustomersParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

// =========================
// Helpers
// =========================
function normalizeList<T>(data: unknown): ListResult<T> {
  // 1) 后端直接返回数组 []
  if (Array.isArray(data)) {
    return { total: data.length, items: data as T[] };
  }

  // 2) 后端返回 { total, items }
  if (data && typeof data === "object") {
    const obj = data as any;
    if (Array.isArray(obj.items)) {
      return {
        total: Number(obj.total ?? obj.items.length),
        items: obj.items as T[],
      };
    }
  }

  // 3) 兜底
  return { total: 0, items: [] };
}

// =========================
// API
// baseURL 已在 http.ts 设置为: http://localhost:5295/api
// 所以这里路径使用 /Customers
// =========================

// 列表（支持 keyword/page/pageSize）
export async function fetchCustomers<T = any>(
  params: FetchCustomersParams = {}
): Promise<ListResult<T>> {
  const { keyword = "", page = 1, pageSize = 10 } = params;

  const res = await http.get("/Customers", {
    params: { keyword, page, pageSize },
  });

  return normalizeList<T>(res.data);
}

// 详情（修复你 CustomerDetail.tsx 报错：缺少 getCustomerById）
export async function getCustomerById<T = any>(id: number | string): Promise<T> {
  const res = await http.get(`/Customers/${id}`);
  return res.data as T;
}

// 新增
export async function createCustomer<T = any>(payload: T) {
  const res = await http.post("/Customers", payload);
  return res.data;
}

// 更新
export async function updateCustomer<T = any>(
  id: number | string,
  payload: Partial<T>
) {
  const res = await http.put(`/Customers/${id}`, payload);
  return res.data;
}

// 删除
export async function deleteCustomer(id: number | string) {
  const res = await http.delete(`/Customers/${id}`);
  return res.data;
}

