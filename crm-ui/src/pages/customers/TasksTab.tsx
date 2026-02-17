import { Button, DatePicker, Input, Modal, Popconfirm, Segmented, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { TaskRecord, createTask, deleteTask, getTasks, updateTask } from "@/api/tasks";

type TaskFilter = "all" | "overdue" | "due3" | "due7";

const PAGE_SIZE = 10;
const BIG_PAGE_SIZE = 200;

function isOverdue(row: TaskRecord) {
  if (row.status === "done") return false;
  if (!row.dueAt) return false;
  return dayjs(row.dueAt).isBefore(dayjs());
}

function isDueWithinDays(row: TaskRecord, days: number) {
  if (row.status === "done") return false;
  if (!row.dueAt) return false;
  const now = dayjs();
  const due = dayjs(row.dueAt);
  return due.isAfter(now) && due.isBefore(now.add(days, "day"));
}

function applyFilter(rows: TaskRecord[], filter: TaskFilter) {
  if (filter === "all") return rows;
  if (filter === "overdue") return rows.filter(isOverdue);
  if (filter === "due3") return rows.filter((r) => isDueWithinDays(r, 3));
  if (filter === "due7") return rows.filter((r) => isDueWithinDays(r, 7));
  return rows;
}

export default function TasksTab({
  customerId,
  filter,
}: {
  customerId: number;
  filter?: TaskFilter;
}) {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const [activeFilter, setActiveFilter] = useState<TaskFilter>("all");

  useEffect(() => {
    setPage(1);
    setKeyword("");
    setActiveFilter(filter ?? "all");
  }, [customerId]);

  useEffect(() => {
    if (!filter) return;
    setActiveFilter(filter);
    setPage(1);
  }, [filter]);

  const usingBigFetch = activeFilter !== "all";

  const queryKey = useMemo(
    () => ["customerTasks", customerId, keyword, activeFilter, usingBigFetch],
    [customerId, keyword, activeFilter, usingBigFetch]
  );

  const q = useQuery({
    queryKey,
    queryFn: () =>
      getTasks<TaskRecord>({
        customerId,
        page: usingBigFetch ? 1 : page,
        pageSize: usingBigFetch ? BIG_PAGE_SIZE : PAGE_SIZE,
        keyword: keyword.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({
      predicate: (x) =>
        Array.isArray(x.queryKey) &&
        x.queryKey[0] === "customerTasks" &&
        x.queryKey[1] === customerId,
    });
  };

  const createM = useMutation({
    mutationFn: () =>
      createTask({
        customerId,
        title: title.trim(),
        dueAt: dueAt ? dayjs(dueAt).toISOString() : null,
        notes: notes.trim() || null,
      }),
    onSuccess: async () => {
      message.success("已新增待办");
      setOpen(false);
      setTitle("");
      setDueAt(null);
      setNotes("");
      await invalidate();
    },
    onError: () => message.error("新增失败"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TaskRecord> }) =>
      updateTask(id, payload), // ✅ 现在 tasks.ts 接受 Partial，不会标红
    onSuccess: async () => {
      await invalidate();
    },
    onError: () => message.error("更新失败"),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: async () => {
      message.success("已删除");
      await invalidate();
    },
    onError: () => message.error("删除失败"),
  });

  const rows: TaskRecord[] = q.data?.items ?? [];
  const filteredRows = useMemo(() => applyFilter(rows, activeFilter), [rows, activeFilter]);

  const displayRows = useMemo(() => {
    if (!usingBigFetch) return filteredRows;
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, usingBigFetch, page]);

  const total = usingBigFetch ? filteredRows.length : q.data?.total ?? 0;

  const columns: ColumnsType<TaskRecord> = [
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (v: TaskRecord["status"]) =>
        v === "done" ? <Tag color="green">Done</Tag> : <Tag color="blue">Todo</Tag>,
    },
    { title: "标题", dataIndex: "title", ellipsis: true },
    {
      title: "截止时间",
      dataIndex: "dueAt",
      width: 240,
      render: (_v, row) => (
        <Space size={8}>
          <span>{row.dueAt ? dayjs(row.dueAt).format("YYYY-MM-DD HH:mm") : "-"}</span>
          {isOverdue(row) ? <Tag color="red">超期</Tag> : null}
          {!isOverdue(row) && isDueWithinDays(row, 3) ? <Tag color="orange">3天内</Tag> : null}
          {!isOverdue(row) && !isDueWithinDays(row, 3) && isDueWithinDays(row, 7) ? (
            <Tag color="gold">7天内</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "操作",
      width: 220,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() =>
              updateM.mutate({
                id: row.id,
                payload: { status: row.status === "done" ? "todo" : "done" },
              })
            }
            loading={updateM.isPending}
          >
            {row.status === "done" ? "标记未完成" : "完成"}
          </Button>

          <Popconfirm title="确认删除？" onConfirm={() => deleteM.mutate(row.id)}>
            <Button size="small" danger loading={deleteM.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 8 }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input
          placeholder="搜索标题/备注"
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          style={{ width: 260 }}
        />

        <Segmented
          value={activeFilter}
          onChange={(v) => {
            setActiveFilter(v as TaskFilter);
            setPage(1);
          }}
          options={[
            { label: "全部", value: "all" },
            { label: "超期", value: "overdue" },
            { label: "3天内", value: "due3" },
            { label: "7天内", value: "due7" },
          ]}
        />

        <Button type="primary" onClick={() => setOpen(true)}>
          新增待办
        </Button>
        <Button onClick={invalidate}>刷新</Button>
        <span style={{ color: "#888" }}>共 {total} 条</span>
      </Space>

      <Table
        rowKey="id"
        loading={q.isLoading}
        columns={columns}
        dataSource={displayRows}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
      />

      <Modal
        title="新增待办"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => {
          if (!title.trim()) return message.warning("请输入待办标题");
          createM.mutate();
        }}
        confirmLoading={createM.isPending}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="待办标题" />
          <DatePicker showTime style={{ width: "100%" }} value={dueAt} onChange={(v) => setDueAt(v)} />
          <Input.TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="备注（可选）" />
        </Space>
      </Modal>
    </div>
  );
}
