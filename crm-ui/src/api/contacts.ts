import axios from "axios";

export type Contact = {
  id: number;
  customerId: number; // 你后端现在返回的是 number（0 也算 number）
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  wechat?: string | null;
  isPrimary: boolean;
  tags?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PagedResult<T> = { items: T[]; total: number };

const http = axios.create({
  baseURL: "http://localhost:5295/api",
});

export async function fetchContacts(params: {
  keyword?: string;
  page: number;
  pageSize: number;
  customerId?: number;
}): Promise<PagedResult<Contact>> {
  const { data } = await http.get("/Contacts", { params });
  return data;
}

export async function createContact(payload: Omit<Contact, "id" | "createdAt" | "updatedAt">) {
  const { data } = await http.post("/Contacts", payload);
  return data;
}

export async function updateContact(id: number, payload: Partial<Contact>) {
  const { data } = await http.put(`/Contacts/${id}`, payload);
  return data;
}

export async function deleteContact(id: number) {
  const { data } = await http.delete(`/Contacts/${id}`);
  return data;
}
