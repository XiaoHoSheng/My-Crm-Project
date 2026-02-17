import { http } from "./http";

export type CustomerNote = {
  id: number;
  customerId: number;
  content: string;
  createdAt: string; // ISO
};

export async function fetchCustomerNotes(customerId: number | string) {
  const res = await http.get(`/customers/${customerId}/notes`);
  return Array.isArray(res.data) ? (res.data as CustomerNote[]) : [];
}

export async function createCustomerNote(customerId: number | string, content: string) {
  const res = await http.post(`/customers/${customerId}/notes`, { content });
  return res.data as CustomerNote;
}

export async function deleteCustomerNote(customerId: number | string, noteId: number | string) {
  await http.delete(`/customers/${customerId}/notes/${noteId}`);
}
