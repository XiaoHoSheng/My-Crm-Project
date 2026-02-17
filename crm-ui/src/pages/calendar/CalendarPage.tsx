import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Segmented,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { fetchCustomers } from "@/api/customers";
import { getTasksPaged, parseDueDate, isDoneStatus } from "@/api/tasks";
import {
  createReservation,
  deleteReservation,
  getReservations,
  type ReservationDto,
} from "@/api/reservations";

import CalendarDnDView from "./CalendarDnDView";

const STAFF_STORAGE_KEY = "crm_current_staff";
function getStoredStaff() {
  try {
    return (localStorage.getItem(STAFF_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}


const { Title, Text } = Typography;

type ViewMode = "Month" | "Week" | "Agenda";
type PageMode = "Standard" | "DnD";

type CalendarItem =
  | (ReservationDto & { kind: "reservation"; time: string })
  | {
      kind: "task";
      id: number;
      customerId?: number | null;
      customerName?: string | null;
      title: string;
      content?: string | null;
      staff?: string | null;
      time: string; // due date ISO
      status?: any;
    };

function toIso(d: Dayjs) {
  return d.toISOString();
}

function fmt(dt?: string | null) {
  if (!dt) return "-";
  const x = dayjs(dt);
  return x.isValid() ? x.format("YYYY-MM-DD HH:mm") : String(dt);
}

function sameDay(a: Dayjs, iso: string) {
  const x = dayjs(iso);
  return x.isValid() && x.isSame(a, "day");
}

function getWeekStart(d: Dayjs) {
  // 以周一为起点
  const dow = d.day(); // 0 Sun .. 6 Sat
  const diff = (dow + 6) % 7; // Mon=>0, Sun=>6
  return d.subtract(diff, "day").startOf("day");
}

export default function CalendarPage() {
  const qc = useQueryClient();

  // ✅ 新增：页面模式
  const [mode, setMode] = useState<PageMode>("Standard");

  // ===== view state =====
  const [view, setView] = useState<ViewMode>("Month");
  const [panelDate, setPanelDate] = useState<Dayjs>(() => dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());

  // ===== filters =====
  const [keyword, setKeyword] = useState<string>("");
  const [staff, setStaff] = useState<string>(() => getStoredStaff());
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<"all" | "reservation" | "task">(
    "all"
  );

  // customers remote search
  const [customerOptions, setCustomerOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const customerSearchTimer = useRef<number | null>(null);

  const monthRange = useMemo(() => {
    const start = panelDate.startOf("month").startOf("day");
    const end = panelDate.endOf("month").endOf("day");
    return { from: toIso(start), to: toIso(end) };
  }, [panelDate]);

  const weekRange = useMemo(() => {
    const start = getWeekStart(selectedDate);
    const end = start.add(6, "day").endOf("day");
    return { from: toIso(start), to: toIso(end), start, end };
  }, [selectedDate]);

  const agendaRange = useMemo(() => {
    const start = dayjs().startOf("day");
    const end = start.add(30, "day").endOf("day");
    return { from: toIso(start), to: toIso(end), start, end };
  }, []);

  // ===== data: reservations =====
  const reservationsQuery = useQuery({
    queryKey: ["reservations", monthRange],
    queryFn: () =>
      getReservations({
        page: 1,
        pageSize: 200,
        from: monthRange.from,
        to: monthRange.to,
      }),
  });

  const reservations = reservationsQuery.data?.items ?? [];

  // ===== data: tasks (overlay) =====
  const tasksQuery = useQuery({
    queryKey: ["tasks-for-calendar"],
    queryFn: async () => {
      const res = await getTasksPaged({
        page: 1,
        pageSize: 200,
        keyword: "",
      });

      const items = (res.items ?? []) as any[];

      const mapped: CalendarItem[] = items
        .map((t) => {
          const due =
            t?.dueDate ?? t?.dueAt ?? t?.due_at ?? t?.due ?? t?.deadline ?? null;
          const d = parseDueDate(due);
          if (!d) return null;

          return {
            kind: "task",
            id: Number(t.id),
            title: String(t.title ?? "(无标题任务)"),
            time: d.toISOString(),
            status: t.status,
            staff: t.assignedTo ?? t.assigned_to ?? null,
            customerId:
              typeof t.customerId === "number"
                ? t.customerId
                : typeof t.customer_id === "number"
                ? t.customer_id
                : null,
            customerName: t.customerName ?? t.customer_name ?? null,
            content: t.notes ?? t.note ?? null,
          } as CalendarItem;
        })
        .filter(Boolean) as CalendarItem[];

      return mapped;
    },
  });

  const tasks = tasksQuery.data ?? [];

  // ===== merge & filter =====
  const mergedItems = useMemo(() => {
    const r: CalendarItem[] = reservations.map((x) => ({
      ...x,
      kind: "reservation",
      time: x.startAt ?? x.createdAt ?? dayjs().toISOString(),
    }));

    const all = [...r, ...tasks];

    const kw = keyword.trim().toLowerCase();
    const st = staff.trim().toLowerCase();

    return all
      .filter((it) => {
        if (typeFilter !== "all" && it.kind !== typeFilter) return false;

        if (customerId != null) {
          const cid =
            it.kind === "reservation" ? it.customerId : it.customerId ?? -1;
          if (cid !== customerId) return false;
        }

        if (st) {
          const s = String(it.staff ?? "");
          if (!s.toLowerCase().includes(st)) return false;
        }

        if (kw) {
          const fields = [
            it.title ?? "",
            (it as any).content ?? "",
            it.customerName ?? "",
            it.staff ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!fields.includes(kw)) return false;
        }

        if (view === "Week") {
          const ms = dayjs(it.time).valueOf();
          return ms >= weekRange.start.valueOf() && ms <= weekRange.end.valueOf();
        }
        if (view === "Agenda") {
          const ms = dayjs(it.time).valueOf();
          return (
            ms >= agendaRange.start.valueOf() && ms <= agendaRange.end.valueOf()
          );
        }
        if (view === "Month") {
          const ms = dayjs(it.time).valueOf();
          return (
            ms >= dayjs(monthRange.from).valueOf() &&
            ms <= dayjs(monthRange.to).valueOf()
          );
        }

        return true;
      })
      .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf());
  }, [
    reservations,
    tasks,
    keyword,
    staff,
    customerId,
    typeFilter,
    view,
    weekRange,
    agendaRange,
    monthRange,
  ]);

  // ===== month dots =====
  const countByDay = useMemo(() => {
    const map = new Map<string, { total: number; task: number; res: number }>();
    for (const it of mergedItems) {
      const key = dayjs(it.time).format("YYYY-MM-DD");
      const cur = map.get(key) ?? { total: 0, task: 0, res: 0 };
      cur.total += 1;
      if (it.kind === "task") cur.task += 1;
      else cur.res += 1;
      map.set(key, cur);
    }
    return map;
  }, [mergedItems]);

  const selectedDayItems = useMemo(() => {
    return mergedItems.filter((it) => sameDay(selectedDate, it.time));
  }, [mergedItems, selectedDate]);

  // ===== CRUD =====
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const createM = useMutation({
    mutationFn: async (v: any) => {
      const payload = {
        customerId: Number(v.customerId),
        startAt: (v.startAt as Dayjs).toISOString(),
        endAt: v.endAt ? (v.endAt as Dayjs).toISOString() : null,
        title: v.title?.trim() || null,
        content: v.content?.trim() || null,
        staff: v.staff?.trim() || null,
        location: v.location?.trim() || null,
        status: v.status?.trim() || null,
      };
      return createReservation(payload);
    },
    onSuccess: async () => {
      message.success("已创建预约");
      setCreateOpen(false);
      form.resetFields();
      await qc.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (e: any) => {
      console.error(e);
      message.error(e?.message ? String(e.message) : "创建预约失败");
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteReservation(id),
    onSuccess: async () => {
      message.success("已删除预约");
      await qc.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => message.error("删除失败"),
  });

  // ===== customer remote search =====
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
          res.items?.map((c) => ({ label: `${c.name} (#${c.id})`, value: c.id })) ??
          [];
        setCustomerOptions(opts);
      } catch {
        // ignore
      }
    }, 250);
  };

  useEffect(() => {
    loadCustomerOptions("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Month date cell =====
  const dateCellRender = (value: Dayjs) => {
    const key = value.format("YYYY-MM-DD");
    const c = countByDay.get(key);
    if (!c || c.total <= 0) return null;

    const dots = Math.min(c.total, 3);
    const rest = c.total - dots;

    return (
      <div style={{ marginTop: 6, display: "flex", gap: 4, alignItems: "center" }}>
        {Array.from({ length: dots }).map((_, idx) => (
          <span
            key={idx}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#1677ff",
              display: "inline-block",
              opacity: 0.9,
            }}
          />
        ))}
        {rest > 0 ? (
          <span style={{ fontSize: 11, color: "#1677ff" }}>+{rest}</span>
        ) : null}
      </div>
    );
  };

  // ===== Header =====
  const HeaderBar = (
    <Card size="small" bodyStyle={{ padding: 14 }} style={{ marginBottom: 12 }}>
      <Row align="middle" justify="space-between" gutter={[12, 12]}>
        <Col>
          <Space direction="vertical" size={2}>
            <Title level={3} style={{ margin: 0 }}>
              Calendar（日程 / 预约）
            </Title>
            <Text type="secondary">
              一个入口：Standard（工作台） / DnD（拖拽拉伸）。保留 /calendar-dnd 作为验证页。
            </Text>
          </Space>
        </Col>

        <Col>
          <Space wrap>
            <Button
              onClick={() => {
                reservationsQuery.refetch();
                tasksQuery.refetch();
              }}
              loading={reservationsQuery.isFetching || tasksQuery.isFetching}
            >
              刷新
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setCreateOpen(true);
                form.setFieldsValue({ startAt: selectedDate, endAt: null });
              }}
            >
              新建预约
            </Button>
          </Space>
        </Col>
      </Row>

      <Divider style={{ margin: "12px 0" }} />

      <Row gutter={[10, 10]} align="middle">
        <Col xs={24} md={6} lg={4}>
          <Segmented<PageMode>
            value={mode}
            onChange={(v) => setMode(v)}
            options={["Standard", "DnD"]}
          />
        </Col>

        <Col xs={24} md={8} lg={8}>
          <Input
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索：客户名 / 主题 / 内容 / 人员"
          />
        </Col>

        <Col xs={24} md={6} lg={5}>
          <Input
            allowClear
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
            placeholder="人员（Owner/Staff）"
          />
        </Col>

        <Col xs={24} md={6} lg={5}>
          <Select
            allowClear
            showSearch
            value={customerId}
            placeholder="客户筛选"
            options={customerOptions}
            onSearch={loadCustomerOptions}
            onChange={(v) => setCustomerId(v)}
            filterOption={false}
          />
        </Col>

        <Col xs={24} md={6} lg={4}>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: "全部", value: "all" },
              { label: "预约", value: "reservation" },
              { label: "任务到期", value: "task" },
            ]}
          />
        </Col>

        <Col xs={24} md={6} lg={2}>
          <Segmented<ViewMode>
            value={view}
            onChange={(v) => setView(v)}
            options={["Month", "Week", "Agenda"]}
            disabled={mode === "DnD"} // ✅ DnD 用 FullCalendar 自己的视图按钮
          />
        </Col>
      </Row>
    </Card>
  );

  // ===== Right panel =====
  const DaySidePanel = (
    <Card
      size="small"
      title={
        <Space>
          <span>当天事项</span>
          <Tag>{selectedDate.format("YYYY-MM-DD")}</Tag>
          <Tag color="blue">{selectedDayItems.length} 条</Tag>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ maxHeight: 560, overflow: "auto", padding: 12 }}>
        <List<CalendarItem>
          loading={reservationsQuery.isFetching || tasksQuery.isFetching}
          dataSource={selectedDayItems}
          locale={{ emptyText: "当天暂无事项" }}
          itemLayout="vertical"
          renderItem={(item) => {
            const isTask = item.kind === "task";
            const statusTag = isTask
              ? isDoneStatus((item as any).status)
                ? <Tag color="green">Done</Tag>
                : <Tag color="orange">Pending</Tag>
              : null;

            return (
              <List.Item
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                  background: "#fff",
                }}
                actions={
                  isTask
                    ? [
                        <Button
                          key="goto"
                          size="small"
                          type="link"
                          style={{ paddingLeft: 0 }}
                          disabled={!item.customerId}
                          href={item.customerId ? `/customers/${item.customerId}` : undefined}
                        >
                          查看客户
                        </Button>,
                      ]
                    : [
                        <Button
                          key="goto"
                          size="small"
                          type="link"
                          style={{ paddingLeft: 0 }}
                          href={`/customers/${(item as any).customerId}`}
                        >
                          查看客户
                        </Button>,
                        <Button
                          key="del"
                          size="small"
                          danger
                          loading={delM.isPending}
                          onClick={() => {
                            Modal.confirm({
                              title: "确认删除这条预约？",
                              okText: "删除",
                              okButtonProps: { danger: true },
                              cancelText: "取消",
                              onOk: async () => delM.mutate((item as any).id),
                            });
                          }}
                        >
                          删除
                        </Button>,
                      ]
                }
              >
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <Space wrap size={8}>
                    <Badge status={isTask ? "warning" : "processing"} />
                    <Text strong>{item.title || "（无标题）"}</Text>
                    <Tag>{fmt(item.time)}</Tag>
                    <Tag color={isTask ? "purple" : "blue"}>
                      {isTask ? "Task" : "Event"}
                    </Tag>
                    {statusTag}
                  </Space>

                  <Space wrap size={8}>
                    {item.customerName ? (
                      <Text type="secondary">
                        客户：{" "}
                        {item.customerId ? (
                          <Link to={`/customers/${item.customerId}`}>{item.customerName}</Link>
                        ) : (
                          item.customerName
                        )}
                      </Text>
                    ) : item.customerId ? (
                      <Text type="secondary">客户ID：{item.customerId}</Text>
                    ) : null}

                    {item.staff ? <Tag>{item.staff}</Tag> : null}
                  </Space>

                  {(item as any).content ? (
                    <Text style={{ whiteSpace: "pre-wrap" }}>{(item as any).content}</Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </Space>
              </List.Item>
            );
          }}
        />
      </div>

      <Divider style={{ margin: 0 }} />
      <div style={{ padding: 12, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="primary"
          onClick={() => {
            setCreateOpen(true);
            form.setFieldsValue({ startAt: selectedDate, endAt: null });
          }}
        >
          + 新建当日预约
        </Button>
      </div>
    </Card>
  );

  // ===== Standard views =====
  const WeekView = (
    <Card
      size="small"
      title={
        <Space>
          <span>周视图</span>
          <Tag>{weekRange.start.format("YYYY-MM-DD")}</Tag>
          <Text type="secondary">~</Text>
          <Tag>{weekRange.end.format("YYYY-MM-DD")}</Tag>
        </Space>
      }
      bodyStyle={{ padding: 12 }}
    >
      <Row gutter={[10, 10]}>
        {Array.from({ length: 7 }).map((_, i) => {
          const d = weekRange.start.add(i, "day");
          const items = mergedItems.filter((it) => sameDay(d, it.time));
          const isToday = d.isSame(dayjs(), "day");
          const isSelected = d.isSame(selectedDate, "day");

          return (
            <Col key={i} xs={24} lg={24}>
              <Card
                size="small"
                hoverable
                onClick={() => setSelectedDate(d)}
                style={{
                  borderRadius: 12,
                  border: isSelected ? "1px solid #1677ff" : "1px solid #f0f0f0",
                  background: isToday ? "#f6ffed" : "#fff",
                }}
                title={
                  <Space>
                    <Text strong>{d.format("ddd")}</Text>
                    <Tag>{d.format("MM-DD")}</Tag>
                    <Tag color="blue">{items.length}条</Tag>
                  </Space>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.slice(0, 4).map((it) => (
                    <div
                      key={`${it.kind}-${it.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 10,
                        background: it.kind === "task" ? "#fff7e6" : "#e6f4ff",
                        border: "1px solid #f0f0f0",
                      }}
                    >
                      <Badge status={it.kind === "task" ? "warning" : "processing"} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={it.title || ""}
                        >
                          {it.title || "（无标题）"}
                        </div>
                        <div style={{ fontSize: 12, color: "#888" }}>
                          {fmt(it.time)}
                          {it.customerName ? ` · ${it.customerName}` : ""}
                        </div>
                      </div>
                      <Tag color={it.kind === "task" ? "purple" : "blue"}>
                        {it.kind === "task" ? "Task" : "Event"}
                      </Tag>
                    </div>
                  ))}
                  {items.length > 4 ? (
                    <Text type="secondary">还有 {items.length - 4} 条…（点击看右侧）</Text>
                  ) : null}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );

  const AgendaView = (
    <Card
      size="small"
      title={
        <Space>
          <span>Agenda（未来 30 天）</span>
          <Tag color="blue">{mergedItems.length} 条</Tag>
        </Space>
      }
      bodyStyle={{ padding: 12 }}
    >
      <List<CalendarItem>
        loading={reservationsQuery.isFetching || tasksQuery.isFetching}
        dataSource={mergedItems}
        locale={{ emptyText: "暂无事项" }}
        renderItem={(it) => {
          const date = dayjs(it.time).format("YYYY-MM-DD");
          const isTask = it.kind === "task";
          return (
            <List.Item
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
              }}
              onClick={() => setSelectedDate(dayjs(it.time))}
              actions={[
                it.customerId ? (
                  <Button key="c" size="small" type="link" href={`/customers/${it.customerId}`}>
                    客户
                  </Button>
                ) : null,
              ].filter(Boolean) as any}
            >
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space wrap>
                  <Tag>{date}</Tag>
                  <Tag>{dayjs(it.time).format("HH:mm")}</Tag>
                  <Tag color={isTask ? "purple" : "blue"}>
                    {isTask ? "Task Due" : "Event"}
                  </Tag>
                  {isTask ? (
                    isDoneStatus((it as any).status) ? (
                      <Tag color="green">Done</Tag>
                    ) : (
                      <Tag color="orange">Pending</Tag>
                    )
                  ) : null}
                </Space>

                <Text strong>{it.title || "（无标题）"}</Text>

                <Space wrap size={8}>
                  {it.customerName ? (
                    <Text type="secondary">
                      客户：{" "}
                      {it.customerId ? (
                        <Link to={`/customers/${it.customerId}`}>{it.customerName}</Link>
                      ) : (
                        it.customerName
                      )}
                    </Text>
                  ) : it.customerId ? (
                    <Text type="secondary">客户ID：{it.customerId}</Text>
                  ) : null}

                  {it.staff ? <Tag>{it.staff}</Tag> : null}
                </Space>

                {(it as any).content ? (
                  <Text type="secondary" style={{ whiteSpace: "pre-wrap" }}>
                    {(it as any).content}
                  </Text>
                ) : null}
              </Space>
            </List.Item>
          );
        }}
      />
    </Card>
  );

  const MonthView = (
    <Card size="small" title="月视图" bodyStyle={{ paddingTop: 8 }}>
      <Calendar
        fullscreen={false}
        value={selectedDate}
        onSelect={(d) => setSelectedDate(d)}
        onPanelChange={(d) => setPanelDate(d)}
        dateCellRender={dateCellRender}
      />
    </Card>
  );

  return (
    <div style={{ padding: 16, textAlign: "left" }}>
      {HeaderBar}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          {mode === "DnD" ? (
            <CalendarDnDView onSelectDate={(d) => setSelectedDate(d)} />
          ) : view === "Month" ? (
            MonthView
          ) : view === "Week" ? (
            WeekView
          ) : (
            AgendaView
          )}
        </Col>

        <Col xs={24} lg={8}>
          {DaySidePanel}
        </Col>
      </Row>

      {/* Create Reservation */}
      <Modal
        title="新建预约"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          createM.mutate(v);
        }}
        confirmLoading={createM.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ startAt: selectedDate, endAt: null, status: "OPEN" }}
        >
          <Form.Item
            name="customerId"
            label="CustomerId"
            rules={[{ required: true, message: "请选择 customerId" }]}
          >
            <Select
              showSearch
              placeholder="搜索客户"
              options={customerOptions}
              onSearch={loadCustomerOptions}
              filterOption={false}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="startAt"
            label="开始时间"
            rules={[{ required: true, message: "请选择开始时间" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="endAt" label="结束时间（可选）">
            <DatePicker showTime style={{ width: "100%" }} allowClear />
          </Form.Item>

          <Form.Item name="title" label="主题（可选）">
            <Input placeholder="例如：到店面谈 / 电话回访" />
          </Form.Item>

          <Form.Item name="staff" label="人员（可选）">
            <Input placeholder="例如：Jason / 或负责人ID" />
          </Form.Item>

          <Form.Item name="location" label="地点（可选）">
            <Input placeholder="例如：门店 / 线上" />
          </Form.Item>

          <Form.Item name="status" label="状态（可选）">
            <Input placeholder="例如：OPEN / DONE / CANCELED" />
          </Form.Item>

          <Form.Item name="content" label="备注（可选）">
            <Input.TextArea rows={4} placeholder="补充说明..." />
          </Form.Item>

          <div style={{ color: "#888", fontSize: 12 }}>
            说明：Standard 模式叠加 Tasks Due；DnD 模式用于拖拽/拉伸预约并保存 end_time。
          </div>
        </Form>
      </Modal>
    </div>
  );
}