import axios from "axios";

export type EventRecord = {
  id: number;
  eventId?: number | null;
  customerId?: number | null;
  customerName?: string | null; // ✅ 全局 Activities 列表会返回
  eventTime?: string | null;
  eventCharacter?: string | null;
  staff?: string | null;
  theme?: string | null;
  content?: string | null;
};

export type PagedResult<T> = {
  total: number;
  items: T[];
};

// =========================
// Activities（全局事件记录）
// GET /api/events?page=&pageSize=&keyword=&customerId=&eventCharacter=&staff=&from=&to=
// =========================
export function getEventsPaged(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  customerId?: number;
  eventCharacter?: string;
  staff?: string;
  from?: string; // ISO
  to?: string; // ISO
}) {
  return axios
    .get<PagedResult<EventRecord>>(`/api/events`, { params })
    .then((r) => r.data);
}

// GET /api/customers/{customerId}/events?page=&pageSize=&keyword=
export function getCustomerEvents(params: {
  customerId: number;
  page: number;
  pageSize: number;
  keyword?: string;
}) {
  const { customerId, ...query } = params;
  return axios
    .get<PagedResult<EventRecord>>(`/api/customers/${customerId}/events`, {
      params: query,
    })
    .then((r) => r.data);
}

// POST /api/customers/{customerId}/events
export function createCustomerEvent(
  customerId: number,
  payload: Partial<EventRecord>
) {
  return axios
    .post<number>(`/api/customers/${customerId}/events`, payload)
    .then((r) => r.data);
}

// PUT /api/events/{id}
export function updateEvent(id: number, payload: Partial<EventRecord>) {
  return axios.put(`/api/events/${id}`, payload).then((r) => r.data);
}

// DELETE /api/events/{id}
export function deleteEvent(id: number) {
  return axios.delete(`/api/events/${id}`).then((r) => r.data);
}
