// src/api/activities.ts
import { http } from "./http";

export type ActivitySource = "event" | "note";

export interface ActivityDto {
  source: ActivitySource;
  id: number;
  customerId: number;
  customerName?: string | null;
  time: string; // ISO string
  title?: string | null;
  content?: string | null;

  // only for events
  eventCharacter?: string | null;
  staff?: string | null;
}

export interface PagedResult<T> {
  total: number;
  items: T[];
}

export type ActivitiesType = "all" | "events" | "notes";

export async function getActivities(params: {
  page: number;
  pageSize: number;
  customerId?: number;
  keyword?: string;
  type?: ActivitiesType;
  from?: string; // ISO
  to?: string; // ISO
  eventCharacter?: string;
  staff?: string;
}): Promise<PagedResult<ActivityDto>> {
  const res = await http.get("/activities", { params });
  return res.data as PagedResult<ActivityDto>;
}

export async function getCustomerActivities(params: {
  customerId: number;
  page: number;
  pageSize: number;
  keyword?: string;
  type?: ActivitiesType;
  from?: string;
  to?: string;
  eventCharacter?: string;
  staff?: string;
}): Promise<PagedResult<ActivityDto>> {
  const { customerId, ...query } = params;
  const res = await http.get(`/customers/${customerId}/activities`, {
    params: query,
  });
  return res.data as PagedResult<ActivityDto>;
}
