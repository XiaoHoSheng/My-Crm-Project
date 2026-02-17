import { http } from "./http";

export type CustomerTypeItem = {
  id: number;
  typeId: number;
  name: string;
};

export async function fetchCustomerTypes(): Promise<CustomerTypeItem[]> {
  const res = await http.get("/CustomerTypes");
  return Array.isArray(res.data) ? (res.data as CustomerTypeItem[]) : [];
}



