// src/api/tasks.ts
import axios from "axios";

const API_BASE = "http://localhost:5295/api";

/** =========================
 *  全局任务（TasksList 用）
 * ========================= */
export type TaskStatus = "Pending" | "Doing" | "Done";

export interface TaskDto {
  id: number;
  title: string;
  status: TaskStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** =========================
 *  客户详情任务（TasksTab 用）
 * ========================= */
export type CustomerTaskStatus = "todo" | "done";

export interface TaskRecord {
  id: number;
  customerId: number;
  title: string;
  status: CustomerTaskStatus;
  dueAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 通用分页结构 */
export interface PagedResult<T> {
  total: number;
  items: T[];
}

/** ✅ 关键：status 同时兼容两套（避免 TS 冲突） */
export type AnyTaskStatus = TaskStatus | CustomerTaskStatus;

/** 兼容两个页面：字段尽量可选 + 允许额外字段 */
export type TaskCreateDto = {
  title: string;

  // 两套状态都允许
  status?: AnyTaskStatus;

  // TasksList 可能用到：
  assignedTo?: string | null;
  dueDate?: string | null;

  // TasksTab 用到：
  customerId?: number;
  dueAt?: string | null;
  notes?: string | null;

  // 允许扩展字段
  [k: string]: any;
};

export type TaskUpdateDto = Partial<TaskCreateDto>;

/** =========================
 *  API
 * ========================= */
export async function getTasks<T = any>(params: {
  keyword?: string;
  page: number;
  pageSize: number;
  customerId?: number;
}) {
  const res = await axios.get<PagedResult<T>>(`${API_BASE}/Tasks`, { params });
  return res.data;
}

/** 给 TasksList.tsx 用的别名 */
export const getTasksPaged = getTasks;

export async function createTask<T = any>(dto: TaskCreateDto) {
  const res = await axios.post<T>(`${API_BASE}/Tasks`, dto);
  return res.data;
}

export async function updateTask(id: number, dto: TaskUpdateDto) {
  await axios.put(`${API_BASE}/Tasks/${id}`, dto);
}

export async function deleteTask(id: number) {
  await axios.delete(`${API_BASE}/Tasks/${id}`);
}

/** =========================
 *  ✅ TasksList 到期/超期工具函数（必须导出）
 * ========================= */

/** 解析 ISO / yyyy-MM-dd / yyyy-MM-ddTHH:mm:ss 等 */
export function parseDueDate(due?: string | null): Date | null {
  if (!due) return null;
  const s = String(due).trim();
  if (!s) return null;

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);

  // 兜底：YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    const dt = new Date(y, mo, da, 23, 59, 59);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

/** 兼容 Done / done / completed 等 */
export function isDoneStatus(status: any) {
  const s = String(status ?? "").toLowerCase();
  return (
    s === "done" ||
    s === "completed" ||
    s === "complete" ||
    s === "finish" ||
    s === "finished" ||
    s === "已完成" ||
    s === "完成"
  );
}

export function isOverdue(
  task: { status?: any; dueDate?: string | null },
  now = new Date()
) {
  const d = parseDueDate(task.dueDate ?? null);
  if (!d) return false;
  return !isDoneStatus(task.status) && d.getTime() < now.getTime();
}

export function isDueWithinDays(
  task: { status?: any; dueDate?: string | null },
  days: number,
  now = new Date()
) {
  const d = parseDueDate(task.dueDate ?? null);
  if (!d) return false;
  if (isDoneStatus(task.status)) return false;

  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}
