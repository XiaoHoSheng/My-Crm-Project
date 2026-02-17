// src/api/reservations.ts
import { http } from "./http";

export interface PagedResult<T> {
  total: number;
  items: T[];
}

export interface ReservationDto {
  id: number;
  customerId: number;
  customerName?: string | null;

  startAt?: string | null;
  endAt?: string | null;

  title?: string | null;
  content?: string | null;

  staff?: string | null;
  method?: string | null;    // ✅ 新增：预约方式（reservation_method -> Method）
  location?: string | null;

  status?: string | null;
  createdAt?: string | null;
}

export type GetReservationsParams = {
  page: number;
  pageSize: number;
  customerId?: number;
  keyword?: string;
  from?: string; // ISO
  to?: string; // ISO
  staff?: string; // 预留：后端若支持可直接传
};

export async function getReservations(params: GetReservationsParams) {
  const res = await http.get<PagedResult<ReservationDto>>("/reservations", { params });
  return res.data;
}

export type CreateReservationPayload = {
  customerId: number;
  startAt: string;
  endAt?: string | null;
  title?: string | null;
  content?: string | null;
  staff?: string | null;
  method?: string | null;   // ✅ 新增
  location?: string | null;
  status?: string | null;
};

export async function createReservation(payload: CreateReservationPayload) {
  const res = await http.post<ReservationDto>("/reservations", payload);
  return res.data;
}

export async function deleteReservation(id: number) {
  await http.delete(`/reservations/${id}`);
}

export type UpdateReservationPayload = Partial<CreateReservationPayload>;

export async function updateReservation(id: number, payload: UpdateReservationPayload) {
  const res = await http.put<ReservationDto>(`/reservations/${id}`, payload);
  return res.data;
}









// // src/api/reservations.ts
// import { http } from "./http";

// export interface PagedResult<T> {
//   total: number;
//   items: T[];
// }

// export interface ReservationDto {
//   id: number;
//   customerId: number;
//   customerName?: string | null;

//   startAt?: string | null;
//   endAt?: string | null;

//   title?: string | null;
//   content?: string | null;

//   staff?: string | null;
//   location?: string | null;

//   status?: string | null;
//   createdAt?: string | null;
// }

// export type GetReservationsParams = {
//   page: number;
//   pageSize: number;
//   customerId?: number;
//   keyword?: string;
//   from?: string; // ISO
//   to?: string; // ISO
//   staff?: string; // 预留：后端若支持可直接传
// };

// export async function getReservations(params: GetReservationsParams) {
//   const res = await http.get<PagedResult<ReservationDto>>("/reservations", {
//     params,
//   });
//   return res.data;
// }

// export type CreateReservationPayload = {
//   customerId: number;
//   startAt: string;
//   endAt?: string | null;
//   title?: string | null;
//   content?: string | null;
//   staff?: string | null;
//   location?: string | null;
//   status?: string | null;
// };

// export async function createReservation(payload: CreateReservationPayload) {
//   const res = await http.post<ReservationDto>("/reservations", payload);
//   return res.data;
// }

// export async function deleteReservation(id: number) {
//   await http.delete(`/reservations/${id}`);
// }

// export type UpdateReservationPayload = Partial<CreateReservationPayload>;

// export async function updateReservation(id: number, payload: UpdateReservationPayload) {
//   const res = await http.put<ReservationDto>(`/reservations/${id}`, payload);
//   return res.data;
// }
