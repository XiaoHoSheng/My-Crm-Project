// src/pages/tasks/TasksList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  message,
  Space,
  Table,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Divider,
  Select,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { fetchCustomers } from "@/api/customers";
import {
  type TaskDto,
  type TaskStatus,
  getTasksPaged,
  createTask,
  updateTask,
  deleteTask,
  isOverdue,
  isDueWithinDays,
  parseDueDate,
} from "@/api/tasks";

import TaskFormModal from "./TaskFormModal";

const STAFF_STORAGE_KEY = "crm_current_staff";
function getStoredStaff() {
  try {
    return (localStorage.getItem(STAFF_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}


const { Text } = Typography;

const statusLabel: Record<TaskStatus, string> = {
  Pending: "Pending",
  Doing: "Doing",
  Done: "Done",
};

function statusTag(status: TaskStatus) {
  if (status === "Done") return <Tag color="green">{statusLabel[status]}</Tag>;
  if (status === "Doing") return <Tag color="blue">{statusLabel[status]}</Tag>;
  return <Tag>{statusLabel[status]}</Tag>;
}

/** 截止日期标签：超期 / 3天内 / 7天内 */
function dueTag(task: Pick<TaskDto, "status" | "dueDate">) {
  if (!task.dueDate) return null;

  if (isOverdue(task)) return <Tag color="red">超期</Tag>;
  if (isDueWithinDays(task, 3)) return <Tag color="orange">3天内到期</Tag>;
  if (isDueWithinDays(task, 7)) return <Tag color="gold">7天内到期</Tag>;
  return <Tag>未临近</Tag>;
}

function formatDue(d?: string | null) {
  if (!d) return "-";
  const dt = parseDueDate(d);
  if (!dt) return d;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type TaskFilter = "all" | "open" | "overdue" | "due3" | "due7" | "done";

function isValidFilter(v: string | null): v is TaskFilter {
  return ["all", "open", "overdue", "due3", "due7", "done"].includes(String(v));
}

function getFilterLabel(f: TaskFilter) {
  switch (f) {
    case "open":
      return "Open（未完成）";
    case "overdue":
      return "Overdue（超期）";
    case "due3":
      return "Due in 3 Days";
    case "due7":
      return "Due in 7 Days";
    case "done":
      return "Done（已完成）";
    default:
      return "All";
  }
}

function normalizeStaff(v?: string | null) {
  return (v ?? "").trim();
}

function parseCustomerId(v?: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function TasksList() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  // ✅ Step 12：如果 URL 没带 staff，则默认用「当前工作人」（localStorage）
  useEffect(() => {
    const urlHasStaff = (sp.get("staff") ?? "").trim();
    if (urlHasStaff) return;
    const stored = getStoredStaff();
    if (!stored) return;
    const next = new URLSearchParams(sp);
    next.set("staff", stored);
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ===== URL params -> state =====
  const urlFilterRaw = sp.get("filter");
  const urlFilter: TaskFilter = isValidFilter(urlFilterRaw) ? (urlFilterRaw as TaskFilter) : "all";

  const urlQ = sp.get("q") ?? "";
  const urlStaff = normalizeStaff(sp.get("staff"));
  const urlCustomerId = parseCustomerId(sp.get("customerId"));

  // 本地状态（可编辑）
  const [keyword, setKeyword] = useState(urlQ);
  const [staff, setStaff] = useState(urlStaff);
  const [customerId, setCustomerId] = useState<number | undefined>(urlCustomerId);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // filter（直接从 URL 取，不在本地 state 里重复）
  const filter = urlFilter;

  // URL 变化时（浏览器后退/前进）同步输入框
  useEffect(() => {
    setKeyword(urlQ);
    setStaff(urlStaff);
    setCustomerId(urlCustomerId);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  // ===== customer remote search =====
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const customerSearchTimer = useRef<number | null>(null);

  const loadCustomerOptions = (q: string) => {
    if (customerSearchTimer.current) window.clearTimeout(customerSearchTimer.current);
    customerSearchTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetchCustomers<{ id: number; name: string }>({
          keyword: q,
          page: 1,
          pageSize: 20,
        });
        const opts =
          res.items?.map((c) => ({ label: `${c.name} (#${c.id})`, value: c.id })) ?? [];
        setCustomerOptions(opts);
      } catch {
        // ignore
      }
    }, 200);
  };

  useEffect(() => {
    loadCustomerOptions("");
  }, []);

  // ===== Mutations modal =====
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const openCreate = () => {
    setModalMode("create");
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: TaskDto) => {
    setModalMode("edit");
    setEditing(row);
    setModalOpen(true);
  };

  // ===== URL sync helpers =====
  const setFilterToUrl = (f: TaskFilter) => {
    const next = new URLSearchParams(sp);
    if (f === "all") next.delete("filter");
    else next.set("filter", f);
    next.delete("page"); // URL 不存 page，切换筛选回到第一页
    setSp(next, { replace: true });
  };

  // 关键：把 keyword/staff/customerId 写回 URL（防抖）
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(sp);

      const q = keyword.trim();
      if (q) next.set("q", q);
      else next.delete("q");

      const s = staff.trim();
      if (s) next.set("staff", s);
      else next.delete("staff");

      if (customerId != null) next.set("customerId", String(customerId));
      else next.delete("customerId");

      // 避免无意义 replace
      if (next.toString() !== sp.toString()) {
        setSp(next, { replace: true });
      }
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, staff, customerId]);

  // ====== data queries ======
  // 主列表（后端分页）：只做基础 keyword
  const queryKey = useMemo(
    () => ["tasks", { keyword, page, pageSize }],
    [keyword, page, pageSize]
  );

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => getTasksPaged({ keyword, page, pageSize }),
    placeholderData: (prev) => prev,
  });

  // Summary：最近 300 条（用作前端聚合 & URL 筛选数据源）
  const summaryKey = useMemo(() => ["tasks_summary", { keyword }], [keyword]);
  const { data: summaryData, isFetching: isSummaryFetching } = useQuery({
    queryKey: summaryKey,
    queryFn: () => getTasksPaged({ keyword, page: 1, pageSize: 300 }),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const summaryItems = summaryData?.items ?? [];

  // 是否启用“前端过滤模式”
  const useClientFiltering = useMemo(() => {
    return filter !== "all" || !!staff.trim() || customerId != null;
  }, [filter, staff, customerId]);

  // ====== filter (client side) ======
  const filteredSummaryItems = useMemo(() => {
    const now = new Date();
    const st = staff.trim().toLowerCase();

    return summaryItems.filter((t: any) => {
      const statusStr = String(t.status || "");
      const isDone = statusStr.toLowerCase() === "done";

      // filter
      if (filter === "done" && !isDone) return false;
      if (filter === "open" && isDone) return false;
      if (filter === "overdue" && (isDone || !isOverdue(t, now))) return false;
      if (filter === "due3" && (isDone || !isDueWithinDays(t, 3, now))) return false;
      if (filter === "due7" && (isDone || !isDueWithinDays(t, 7, now))) return false;

      // staff filter
      if (st) {
        const assigned = String(t.assignedTo ?? t.assigned_to ?? "").toLowerCase();
        if (!assigned.includes(st)) return false;
      }

      // customer filter
      if (customerId != null) {
        const cid = Number(t.customerId ?? t.customer_id ?? NaN);
        if (!Number.isFinite(cid) || cid !== customerId) return false;
      }

      return true;
    });
  }, [summaryItems, filter, staff, customerId]);

  // table data
  const tableData = useMemo(() => {
    if (!useClientFiltering) return items;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredSummaryItems.slice(start, end);
  }, [useClientFiltering, items, filteredSummaryItems, page, pageSize]);

  const tableTotal = useClientFiltering ? filteredSummaryItems.length : total;

  // Summary stats（基于 recent 300）
  const summary = useMemo(() => {
    const now = new Date();
    const overdue = summaryItems.filter((t) => isOverdue(t, now)).length;
    const due3 = summaryItems.filter((t) => isDueWithinDays(t, 3, now)).length;
    const due7 = summaryItems.filter((t) => isDueWithinDays(t, 7, now)).length;
    return { overdue, due3, due7, sample: summaryItems.length };
  }, [summaryItems]);

  const columns: ColumnsType<TaskDto> = [
    { title: "ID", dataIndex: "id", width: 80, fixed: "left" },
    { title: "标题", dataIndex: "title", width: 260, ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (v: TaskStatus) => statusTag(v),
    },
    {
      title: "负责人",
      dataIndex: "assignedTo",
      width: 160,
      ellipsis: true,
      render: (_: any, row: any) => row.assignedTo ?? row.assigned_to ?? "-",
    },
    {
      title: "客户",
      dataIndex: "customerId",
      width: 140,
      render: (_: any, row: any) => {
        const cid = row.customerId ?? row.customer_id;
        return cid ? <Tag>#{cid}</Tag> : "-";
      },
    },
    {
      title: "截止日期",
      dataIndex: "dueDate",
      width: 260,
      render: (_v: string | null | undefined, row: any) => (
        <Space size={8}>
          <span>{formatDue(row.dueDate ?? row.due_date ?? null)}</span>
          {dueTag({ status: row.status, dueDate: row.dueDate ?? row.due_date ?? null } as any)}
        </Space>
      ),
    },
    {
      title: "更新于",
      dataIndex: "updatedAt",
      width: 220,
      render: (v?: string | null) => v ?? "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      fixed: "right",
      render: (_, row: any) => (
        <Space size={8}>
          <Button size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>

          <Popconfirm
            title="确认删除？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                setDeletingId(Number(row.id));
                await deleteTask(Number(row.id));
                message.success("删除成功");
                qc.invalidateQueries({ queryKey: ["tasks"] });
                qc.invalidateQueries({ queryKey: ["tasks_summary"] });
              } catch (e: any) {
                message.error(e?.message ?? "删除失败");
              } finally {
                setDeletingId(null);
              }
            }}
          >
            <Button danger size="small" loading={deletingId === Number(row.id)}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const clearAllFilters = () => {
    const next = new URLSearchParams(sp);
    next.delete("filter");
    next.delete("q");
    next.delete("staff");
    next.delete("customerId");
    setSp(next, { replace: true });
  };

  return (
    <div>
      {/* ✅ Summary Bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={24} md={18}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={8}>
                <Statistic title="超期任务" value={summary.overdue} loading={isSummaryFetching} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="3天内到期" value={summary.due3} loading={isSummaryFetching} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="7天内到期" value={summary.due7} loading={isSummaryFetching} />
              </Col>
            </Row>
          </Col>

          <Col xs={24} sm={24} md={6} style={{ textAlign: "right" }}>
            <Space>
              <Tooltip title="统计与筛选基于最近 300 条（后续可做后端过滤/统计接口实现全量精准）">
                <Text type="secondary">样本：{summary.sample}</Text>
              </Tooltip>
              <Button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["tasks_summary"] });
                  qc.invalidateQueries({ queryKey: ["tasks"] });
                }}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        {/* ✅ URL Filter Bar */}
        <Space wrap>
          <Text type="secondary">筛选：</Text>

          <Tag.CheckableTag checked={filter === "all"} onChange={() => setFilterToUrl("all")}>
            All
          </Tag.CheckableTag>

          <Tag.CheckableTag checked={filter === "open"} onChange={() => setFilterToUrl("open")}>
            Open
          </Tag.CheckableTag>

          <Tag.CheckableTag checked={filter === "overdue"} onChange={() => setFilterToUrl("overdue")}>
            Overdue
          </Tag.CheckableTag>

          <Tag.CheckableTag checked={filter === "due3"} onChange={() => setFilterToUrl("due3")}>
            Due3
          </Tag.CheckableTag>

          <Tag.CheckableTag checked={filter === "due7"} onChange={() => setFilterToUrl("due7")}>
            Due7
          </Tag.CheckableTag>

          <Tag.CheckableTag checked={filter === "done"} onChange={() => setFilterToUrl("done")}>
            Done
          </Tag.CheckableTag>

          {(useClientFiltering || keyword.trim()) && (
            <>
              <Text type="secondary">当前：</Text>
              <Tag color="blue">{getFilterLabel(filter)}</Tag>
              {staff.trim() ? <Tag>staff:{staff.trim()}</Tag> : null}
              {customerId != null ? <Tag>customerId:{customerId}</Tag> : null}
              {keyword.trim() ? <Tag>q:{keyword.trim()}</Tag> : null}
              <Button size="small" onClick={clearAllFilters}>
                清除全部
              </Button>
              <Tooltip title="提示：只要启用 staff/customerId/filter，就会切换到前端聚合筛选（最近300条）。">
                <Text type="secondary">（前端聚合）</Text>
              </Tooltip>
            </>
          )}
        </Space>

        <Divider style={{ margin: "12px 0" }} />

        {/* ✅ Advanced filters (URL-synced) */}
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10} lg={8}>
            <Input
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="关键词（同步到 URL：?q=）"
            />
          </Col>

          <Col xs={24} md={7} lg={6}>
            <Input
              allowClear
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
                setPage(1);
              }}
              placeholder="Staff（同步到 URL：?staff=）"
            />
          </Col>

          <Col xs={24} md={7} lg={6}>
            <Select
              allowClear
              showSearch
              value={customerId}
              placeholder="Customer（同步到 URL：?customerId=）"
              options={customerOptions}
              onSearch={loadCustomerOptions}
              onChange={(v) => {
                setCustomerId(v);
                setPage(1);
              }}
              filterOption={false}
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={24} lg={4} style={{ textAlign: "right" }}>
            <Space wrap>
              <Button onClick={() => qc.invalidateQueries({ queryKey: ["tasks_summary"] })}>
                重新聚合
              </Button>
              <Button type="primary" onClick={openCreate}>
                新增任务
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table<TaskDto>
        rowKey="id"
        loading={useClientFiltering ? isSummaryFetching : isFetching}
        dataSource={tableData as any}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: tableTotal,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1400 }}
        tableLayout="fixed"
      />

      <TaskFormModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onSubmit={async (v) => {
          setSaving(true);
          try {
            if (modalMode === "create") {
              await createTask(v);
              message.success("创建成功");
            } else {
              if (!editing) throw new Error("缺少编辑对象");
              await updateTask(editing.id, v);
              message.success("保存成功");
            }

            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["tasks_summary"] });
          } catch (e: any) {
            message.error(e?.message ?? "保存失败");
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}