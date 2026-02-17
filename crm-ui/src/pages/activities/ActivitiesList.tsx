// src/pages/activities/ActivitiesList.tsx
import { useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  createCustomerEvent,
  deleteEvent,
  getEventsPaged,
  updateEvent,
  type EventRecord,
} from "@/api/events";
import { fetchCustomers } from "@/api/customers";

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Title, Text } = Typography;

const EVENT_TYPES = [
  { value: "CALL", label: "电话" },
  { value: "MEETING", label: "会议" },
  { value: "VISIT", label: "拜访" },
  { value: "EMAIL", label: "邮件" },
  { value: "WECHAT", label: "微信" },
];

type CustomerOption = {
  id: number;
  name?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
};

function fmtTime(v?: string | null) {
  if (!v) return "-";
  return dayjs(v).format("YYYY-MM-DD HH:mm");
}

function normalizeRange(r: [dayjs.Dayjs, dayjs.Dayjs] | null) {
  if (!r) return null;
  return [r[0].startOf("day"), r[1].endOf("day")] as [dayjs.Dayjs, dayjs.Dayjs];
}

function isSameRange(
  a: [dayjs.Dayjs, dayjs.Dayjs] | null,
  b: [dayjs.Dayjs, dayjs.Dayjs] | null
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const na = normalizeRange(a);
  const nb = normalizeRange(b);
  if (!na || !nb) return false;
  return na[0].isSame(nb[0]) && na[1].isSame(nb[1]);
}

export default function ActivitiesList() {
  const qc = useQueryClient();

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // filters
  const [keyword, setKeyword] = useState("");
  const [eventCharacter, setEventCharacter] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [staff, setStaff] = useState("");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // modal (create/edit)
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [form] = Form.useForm();

  // drawer (record detail)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventRecord | null>(null);

  // customer lookup (remote)
  const [customerSearch, setCustomerSearch] = useState("");
  const customersQuery = useQuery({
    queryKey: ["customers_lookup", customerSearch],
    queryFn: async () => {
      const res = await fetchCustomers<CustomerOption>({
        keyword: customerSearch.trim(),
        page: 1,
        pageSize: 20,
      });
      return res.items;
    },
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const customerOptions = useMemo(() => {
    const items = customersQuery.data ?? [];
    return items
      .filter((x) => typeof x?.id === "number")
      .map((c) => ({
        value: c.id,
        label: `${c.name ?? "(未命名)"}${c.phone ? ` · ${c.phone}` : ""}`,
      }));
  }, [customersQuery.data]);

  const normalizedRange = useMemo(() => normalizeRange(range), [range]);

  const queryKey = useMemo(
    () => [
      "events",
      {
        page,
        pageSize,
        keyword,
        customerId,
        eventCharacter,
        staff,
        from: normalizedRange ? normalizedRange[0].toISOString() : undefined,
        to: normalizedRange ? normalizedRange[1].toISOString() : undefined,
      },
    ],
    [page, pageSize, keyword, customerId, eventCharacter, staff, normalizedRange]
  );

  const q = useQuery({
    queryKey,
    queryFn: () =>
      getEventsPaged({
        page,
        pageSize,
        keyword: keyword.trim() || undefined,
        customerId,
        eventCharacter,
        staff: staff.trim() || undefined,
        from: normalizedRange ? normalizedRange[0].toISOString() : undefined,
        to: normalizedRange ? normalizedRange[1].toISOString() : undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const invalidate = async () => {
    // 全局列表
    await qc.invalidateQueries({ queryKey: ["events"] });
    // 客户详情页里 EventsTab（如果用户同时开着）
    await qc.invalidateQueries({ queryKey: ["customerEvents"] });
  };

  const createM = useMutation({
    mutationFn: async (payload: { customerId: number; data: Partial<EventRecord> }) =>
      createCustomerEvent(payload.customerId, payload.data),
    onSuccess: async () => {
      message.success("已新增活动");
      await invalidate();
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
  });

  const updateM = useMutation({
    mutationFn: async (payload: { id: number; data: Partial<EventRecord> }) =>
      updateEvent(payload.id, payload.data),
    onSuccess: async () => {
      message.success("已更新活动");
      await invalidate();
      setOpen(false);
      setEditing(null);
      form.resetFields();
      // 抽屉里展示的信息也同步一下（避免用户觉得没更新）
      if (selected?.id === editing?.id) {
        setSelected((prev) => (prev ? { ...prev, ...form.getFieldsValue() } : prev));
      }
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: async () => {
      message.success("已删除");
      await invalidate();
      setDrawerOpen(false);
      setSelected(null);
    },
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  // Quick ranges
  const todayRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs(), dayjs()];
  const last7Range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().add(-6, "day"), dayjs()];
  const last30Range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().add(-29, "day"), dayjs()];

  const activePreset = useMemo(() => {
    if (!range) return "ALL";
    if (isSameRange(range, todayRange)) return "TODAY";
    if (isSameRange(range, last7Range)) return "LAST7";
    if (isSameRange(range, last30Range)) return "LAST30";
    return "CUSTOM";
  }, [range]);

  const setPreset = (key: "ALL" | "TODAY" | "LAST7" | "LAST30") => {
    setPage(1);
    if (key === "ALL") setRange(null);
    if (key === "TODAY") setRange(todayRange);
    if (key === "LAST7") setRange(last7Range);
    if (key === "LAST30") setRange(last30Range);
  };

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
    form.setFieldsValue({
      eventTime: dayjs(),
      eventCharacter: "CALL",
    });
  };

  const openEdit = (row: EventRecord) => {
    setEditing(row);
    setOpen(true);
    form.setFieldsValue({
      customerId: row.customerId ?? undefined,
      eventTime: row.eventTime ? dayjs(row.eventTime) : dayjs(),
      eventCharacter: row.eventCharacter ?? undefined,
      staff: row.staff ?? undefined,
      theme: row.theme ?? undefined,
      content: row.content ?? undefined,
    });
  };

  const openDrawer = (row: EventRecord) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const columns: ColumnsType<EventRecord> = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "eventTime",
        width: 170,
        render: (v) => fmtTime(v),
      },
      {
        title: "类型",
        dataIndex: "eventCharacter",
        width: 110,
        render: (v) => (v ? <Tag>{v}</Tag> : "-"),
      },
      {
        title: "客户",
        dataIndex: "customerName",
        width: 220,
        ellipsis: true,
        render: (_v, row) => {
          const name = row.customerName ?? `Customer #${row.customerId ?? "-"}`;
          if (!row.customerId) return name;
          return <Link to={`/customers/${row.customerId}`}>{name}</Link>;
        },
      },
      {
        title: "人员",
        dataIndex: "staff",
        width: 140,
        ellipsis: true,
        render: (v) => v || "-",
      },
      {
        title: "主题",
        dataIndex: "theme",
        width: 240,
        ellipsis: true,
        render: (v) => v || "-",
      },
      {
        title: "内容",
        dataIndex: "content",
        ellipsis: true,
        render: (v) => v || "-",
      },
      {
        title: "操作",
        key: "actions",
        width: 170,
        fixed: "right",
        render: (_, row) => (
          <Space size={8}>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定删除这条活动？"
              okText="删除"
              cancelText="取消"
              onConfirm={(e) => {
                e?.stopPropagation?.();
                deleteM.mutate(row.id);
              }}
            >
              <Button
                danger
                size="small"
                loading={deleteM.isPending}
                onClick={(e) => e.stopPropagation()}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteM.isPending]
  );

  const timelineItems = useMemo(() => {
    if (!selected) return [];
    const t = selected.eventTime ? dayjs(selected.eventTime).format("YYYY-MM-DD HH:mm") : "-";
    const customerName =
      selected.customerName ?? (selected.customerId ? `Customer #${selected.customerId}` : "-");

    return [
      {
        children: (
          <div>
            <Text type="secondary">时间</Text>
            <div style={{ marginTop: 4 }}>{t}</div>
          </div>
        ),
      },
      {
        children: (
          <div>
            <Text type="secondary">类型</Text>
            <div style={{ marginTop: 4 }}>{selected.eventCharacter ? <Tag>{selected.eventCharacter}</Tag> : "-"}</div>
          </div>
        ),
      },
      {
        children: (
          <div>
            <Text type="secondary">客户</Text>
            <div style={{ marginTop: 4 }}>
              {selected.customerId ? (
                <Link to={`/customers/${selected.customerId}`} onClick={() => setDrawerOpen(false)}>
                  {customerName}
                </Link>
              ) : (
                customerName
              )}
            </div>
          </div>
        ),
      },
      {
        children: (
          <div>
            <Text type="secondary">人员</Text>
            <div style={{ marginTop: 4 }}>{selected.staff || "-"}</div>
          </div>
        ),
      },
      {
        children: (
          <div>
            <Text type="secondary">主题</Text>
            <div style={{ marginTop: 4 }}>{selected.theme || "-"}</div>
          </div>
        ),
      },
      {
        children: (
          <div>
            <Text type="secondary">内容</Text>
            <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.content || "-"}</div>
          </div>
        ),
      },
    ];
  }, [selected]);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={14}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Activities
          </Title>
          <Text type="secondary">全局跟进记录（跨客户）</Text>
        </div>

        <Button type="primary" onClick={openCreate}>
          New Activity
        </Button>
      </div>

      {/* Quick Filters (Salesforce 风格) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Text type="secondary">Quick Filters：</Text>
        <Button
          size="small"
          type={activePreset === "ALL" ? "primary" : "default"}
          onClick={() => setPreset("ALL")}
        >
          All
        </Button>
        <Button
          size="small"
          type={activePreset === "TODAY" ? "primary" : "default"}
          onClick={() => setPreset("TODAY")}
        >
          Today
        </Button>
        <Button
          size="small"
          type={activePreset === "LAST7" ? "primary" : "default"}
          onClick={() => setPreset("LAST7")}
        >
          Last 7 days
        </Button>
        <Button
          size="small"
          type={activePreset === "LAST30" ? "primary" : "default"}
          onClick={() => setPreset("LAST30")}
        >
          Last 30 days
        </Button>

        <Text type="secondary" style={{ marginLeft: 8 }}>
          共 {total} 条
        </Text>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Input
          placeholder="搜索：客户名 / 主题 / 内容 / 人员"
          value={keyword}
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
          allowClear
          style={{ width: 280 }}
        />

        <Select
          placeholder="类型"
          value={eventCharacter}
          onChange={(v) => {
            setPage(1);
            setEventCharacter(v);
          }}
          allowClear
          options={EVENT_TYPES}
          style={{ width: 140 }}
        />

        <Select
          placeholder="客户"
          value={customerId}
          onChange={(v) => {
            setPage(1);
            setCustomerId(v);
          }}
          allowClear
          showSearch
          filterOption={false}
          onSearch={(v) => setCustomerSearch(v)}
          options={customerOptions}
          loading={customersQuery.isFetching}
          style={{ width: 260 }}
        />

        <Input
          placeholder="人员（可选）"
          value={staff}
          onChange={(e) => {
            setPage(1);
            setStaff(e.target.value);
          }}
          allowClear
          style={{ width: 180 }}
        />

        <RangePicker
          value={range as any}
          onChange={(v) => {
            setPage(1);
            setRange(v ? (v as any) : null);
          }}
        />

        <Button
          onClick={() => {
            setKeyword("");
            setEventCharacter(undefined);
            setCustomerId(undefined);
            setStaff("");
            setRange(null);
            setCustomerSearch("");
            setPage(1);
          }}
        >
          重置
        </Button>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={q.isFetching}
        dataSource={items}
        columns={columns}
        scroll={{ x: 1100 }}
        onRow={(record) => ({
          onClick: () => openDrawer(record),
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Drawer (Record view) */}
      <Drawer
        title="Activity"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelected(null);
        }}
        width={520}
        extra={
          selected ? (
            <Space>
              <Button onClick={() => openEdit(selected)}>编辑</Button>
              <Popconfirm
                title="确定删除这条活动？"
                okText="删除"
                cancelText="取消"
                onConfirm={() => deleteM.mutate(selected.id)}
              >
                <Button danger loading={deleteM.isPending}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {selected ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Text type="secondary">
              记录 ID：{selected.id} {selected.eventId ? ` · eventId=${selected.eventId}` : ""}
            </Text>

            <Timeline items={timelineItems as any} />

            <div style={{ paddingTop: 8 }}>
              <Button type="primary" onClick={() => openCreate()}>
                New Activity
              </Button>
            </div>
          </Space>
        ) : (
          <Text type="secondary">请选择一条活动查看详情</Text>
        )}
      </Drawer>

      {/* Create/Edit Modal */}
      <Modal
        title={editing ? "Edit Activity" : "New Activity"}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          const v = await form.validateFields();

          const payload: Partial<EventRecord> = {
            eventTime: v.eventTime?.toISOString(),
            eventCharacter: v.eventCharacter,
            staff: v.staff,
            theme: v.theme,
            content: v.content,
          };

          if (editing) {
            updateM.mutate({ id: editing.id, data: payload });
            return;
          }

          const cid: number = v.customerId;
          createM.mutate({ customerId: cid, data: payload });
        }}
        confirmLoading={createM.isPending || updateM.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: "请选择客户" }]}
          >
            <Select
              placeholder="搜索并选择客户"
              allowClear
              disabled={!!editing} // ✅ 后端 update 接口暂不支持更换 customerId（保持一致更安全）
              showSearch
              filterOption={false}
              onSearch={(v) => setCustomerSearch(v)}
              options={customerOptions}
              loading={customersQuery.isFetching}
            />
          </Form.Item>

          <Form.Item name="eventTime" label="时间" rules={[{ required: true, message: "请选择时间" }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="eventCharacter"
            label="类型"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select options={EVENT_TYPES} placeholder="请选择事件类型" />
          </Form.Item>

          <Form.Item name="staff" label="人员">
            <Input placeholder="例如：Jason" />
          </Form.Item>

          <Form.Item name="theme" label="主题" rules={[{ required: true, message: "请输入主题" }]}>
            <Input placeholder="例如：电话跟进" />
          </Form.Item>

          <Form.Item name="content" label="内容">
            <TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}