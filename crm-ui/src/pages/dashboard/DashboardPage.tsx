import React, { useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  List,
  Tag,
  Space,
  Typography,
  Button,
  Skeleton,
  Alert,
  Input,
  Divider,
  Tooltip,
} from "antd";
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  RightOutlined,
  FireOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchCustomers } from "@/api/customers";
import {
  getTasksPaged,
  isDoneStatus,
  parseDueDate,
  isOverdue,
  isDueWithinDays,
  type TaskDto,
} from "@/api/tasks";
import { getReservations, type ReservationDto } from "@/api/reservations";

const STAFF_STORAGE_KEY = "crm_current_staff";
function getStoredStaff() {
  try {
    return (localStorage.getItem(STAFF_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}


const { Title, Text } = Typography;

type MiniItem = {
  title: string;
  desc?: string;
  extra?: React.ReactNode;
};

function startOfTodayLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfTodayLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function safeDate(d?: string | null): Date | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t);
}

function fmtTime(d?: Date | null): string {
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildTasksUrl(params: {
  filter?: string;
  q?: string;
  staff?: string;
  customerId?: string;
}) {
  const sp = new URLSearchParams();
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.q) sp.set("q", params.q);
  if (params.staff) sp.set("staff", params.staff);
  if (params.customerId) sp.set("customerId", params.customerId);
  const qs = sp.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

export default function DashboardPage() {
  const nav = useNavigate();

  // ✅ Step 8：Dashboard 快捷筛选（staff/customerId）一键跳 Tasks / Calendar
  const [staff, setStaff] = useState(() => getStoredStaff());
  const [customerId, setCustomerId] = useState("");

  const todayFrom = useMemo(() => startOfTodayLocal().toISOString(), []);
  const todayTo = useMemo(() => endOfTodayLocal().toISOString(), []);

  // ============ Queries ============
  const customersQuery = useQuery({
    queryKey: ["dashboard", "customersTotal"],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 1 }),
  });

  // Dashboard 指标：取最近 300 条做聚合
  const tasksQuery = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => getTasksPaged<TaskDto>({ page: 1, pageSize: 300 }),
  });

  const reservationsQuery = useQuery({
    queryKey: ["dashboard", "reservations", todayFrom, todayTo],
    queryFn: () =>
      getReservations({ page: 1, pageSize: 200, from: todayFrom, to: todayTo }),
  });

  // ============ Aggregation ============
  const tasksAgg = useMemo(() => {
    const now = new Date();
    const items = tasksQuery.data?.items ?? [];
    const openTasks = items.filter((t: any) => !isDoneStatus(t.status));

    const overdue = openTasks.filter((t: any) => isOverdue(t, now)).length;
    const due3 = openTasks.filter((t: any) => isDueWithinDays(t, 3, now)).length;
    const due7 = openTasks.filter((t: any) => isDueWithinDays(t, 7, now)).length;

    const top5 = [...openTasks]
      .sort((a: any, b: any) => {
        const da = parseDueDate(a.dueDate ?? a.due_date ?? null);
        const db = parseDueDate(b.dueDate ?? b.due_date ?? null);
        const ta = da ? da.getTime() : Number.POSITIVE_INFINITY;
        const tb = db ? db.getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      })
      .slice(0, 5);

    return {
      openCount: openTasks.length,
      overdue,
      due3,
      due7,
      top5,
      sample: items.length,
    };
  }, [tasksQuery.data]);

  const reservationsAgg = useMemo(() => {
    const items = reservationsQuery.data?.items ?? [];
    const sorted = [...items].sort((a, b) => {
      const da = safeDate(a.startAt);
      const db = safeDate(b.startAt);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      return ta - tb;
    });

    return { todayCount: items.length, top5: sorted.slice(0, 5) };
  }, [reservationsQuery.data]);

  const customersTotal = customersQuery.data?.total ?? 0;

  const anyError =
    (customersQuery.isError ? (customersQuery.error as any)?.message : null) ||
    (tasksQuery.isError ? (tasksQuery.error as any)?.message : null) ||
    (reservationsQuery.isError
      ? (reservationsQuery.error as any)?.message
      : null);

  const loading =
    customersQuery.isLoading || tasksQuery.isLoading || reservationsQuery.isLoading;

  // ============ Lists ============
  const myTasksList: MiniItem[] = useMemo(() => {
    return tasksAgg.top5.map((t: any) => {
      const due = parseDueDate(t.dueDate ?? t.due_date ?? null);
      const dueText = due ? `到期：${due.toLocaleDateString()}` : "无到期日";

      const assigned = (t.assignedTo ?? t.assigned_to ?? "").trim();
      const staffText = assigned ? ` · 负责人：${assigned}` : "";

      const tag = isOverdue(t) ? (
        <Tag color="red">Overdue</Tag>
      ) : isDueWithinDays(t, 3) ? (
        <Tag color="orange">Due3</Tag>
      ) : isDueWithinDays(t, 7) ? (
        <Tag color="gold">Due7</Tag>
      ) : (
        <Tag>Open</Tag>
      );

      return {
        title: t.title,
        desc: `${dueText}${staffText}`,
        extra: tag,
      };
    });
  }, [tasksAgg.top5]);

  const todayReservationsList: MiniItem[] = useMemo(() => {
    return reservationsAgg.top5.map((r: ReservationDto) => {
      const st = safeDate(r.startAt);
      const et = safeDate(r.endAt);
      const timeText = `${fmtTime(st)}${et ? ` - ${fmtTime(et)}` : ""}`;

      const method = r.method ? `方式：${r.method}` : null;
      const staffText = r.staff ? `负责人：${r.staff}` : null;

      const parts = [
        timeText,
        r.customerName ? `客户：${r.customerName}` : `客户ID：${r.customerId}`,
        method,
        staffText,
      ].filter(Boolean);

      const status = (r.status ?? "OPEN").toUpperCase();
      const tag =
        status === "DONE" ? (
          <Tag color="green">DONE</Tag>
        ) : status === "CANCELLED" ? (
          <Tag color="red">CANCELLED</Tag>
        ) : (
          <Tag color="blue">OPEN</Tag>
        );

      return {
        title: r.title ? r.title : "（无主题）",
        desc: parts.join(" · "),
        extra: tag,
      };
    });
  }, [reservationsAgg.top5]);

  // ====== Quick helpers ======
  const staffQ = staff.trim();
  const customerQ = customerId.trim();

  const goTasks = (filter: string) => {
    nav(
      buildTasksUrl({
        filter,
        staff: staffQ || undefined,
        customerId: customerQ || undefined,
      })
    );
  };

  const goCalendarToday = (mode: "standard" | "dnd") => {
    if (mode === "dnd") {
      nav(
        `/calendar?date=today&mode=dnd&view=day${
          staffQ ? `&staff=${encodeURIComponent(staffQ)}` : ""
        }`
      );
    } else {
      nav(
        `/calendar?date=today&view=week${
          staffQ ? `&staff=${encodeURIComponent(staffQ)}` : ""
        }`
      );
    }
  };

  const kpiCardStyle: React.CSSProperties = {
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease",
  };

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Row align="middle" justify="space-between" gutter={[12, 12]}>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">
              Step 8：Dashboard 快捷筛选（staff/customerId）→ 一键跳 Tasks（overdue/due3/due7）与 Calendar（today/week/day）
            </Text>
          </Col>
          <Col>
            <Space wrap>
              <Button icon={<CheckSquareOutlined />} onClick={() => goTasks("open")}>
                Open Tasks
              </Button>
              <Button
                type="primary"
                icon={<CalendarOutlined />}
                onClick={() => goCalendarToday("standard")}
              >
                Today · Week
              </Button>
            </Space>
          </Col>
        </Row>

        {anyError && (
          <Alert
            type="error"
            showIcon
            message="Dashboard 数据加载失败（不影响其它页面）"
            description={String(anyError)}
          />
        )}

        {/* ✅ Quick Filters（重排优化：md 及以下按钮整行下移，不再在右侧“竖排”挤压） */}
        <Card size="small">
          <Row gutter={[12, 12]} align="middle">
            {/* md：两列输入并排；xs：各占一行 */}
            <Col xs={24} md={12} lg={7}>
              <Input
                allowClear
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
                placeholder="Quick Staff（可选，跳转时带 ?staff=）"
              />
            </Col>
            <Col xs={24} md={12} lg={7}>
              <Input
                allowClear
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Quick CustomerId（可选，跳转时带 ?customerId=）"
              />
            </Col>

            {/* md：按钮独占一整行；lg：右侧同一行 */}
            <Col xs={24} md={24} lg={10}>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <Space wrap>
                  <Tooltip title="带上 staff/customerId 一键跳转到 Tasks 并自动应用筛选">
                    <Button onClick={() => goTasks("open")}>Open</Button>
                  </Tooltip>
                  <Button icon={<FireOutlined />} onClick={() => goTasks("overdue")}>
                    Overdue
                  </Button>
                  <Button icon={<ClockCircleOutlined />} onClick={() => goTasks("due3")}>
                    Due3
                  </Button>
                  <Button onClick={() => goTasks("due7")}>Due7</Button>

                  <Divider type="vertical" style={{ height: 20 }} />

                  <Button onClick={() => goCalendarToday("standard")}>
                    Calendar Week
                  </Button>
                  <Button onClick={() => goCalendarToday("dnd")}>
                    Calendar DnD Day
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>

          <Divider style={{ margin: "12px 0" }} />

          <Space wrap>
            <Text type="secondary">提示：</Text>
            <Tag>Tasks URL 支持 filter/q/staff/customerId</Tag>
            <Tag>Calendar URL 支持 date/view/mode/staff</Tag>
            <Tooltip title="Dashboard 指标基于最近 300 条任务（后续可加后端聚合接口做全量准确）。">
              <Text type="secondary">任务样本：{tasksAgg.sample}</Text>
            </Tooltip>
          </Space>
        </Card>

        {/* ✅ KPI row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card hoverable style={kpiCardStyle} onClick={() => nav("/customers")}>
              {customersQuery.isLoading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title="总客户数"
                  value={customersTotal}
                  prefix={<BarChartOutlined />}
                />
              )}
              <Text type="secondary">点击查看 Customers</Text>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card hoverable style={kpiCardStyle} onClick={() => goTasks("open")}>
              {tasksQuery.isLoading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title="待办任务"
                  value={tasksAgg.openCount}
                  prefix={<CheckSquareOutlined />}
                />
              )}
              <Text type="secondary">点击查看 Open Tasks（带 staff/customerId）</Text>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card hoverable style={kpiCardStyle} onClick={() => goTasks("overdue")}>
              {tasksQuery.isLoading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title="超期任务"
                  value={tasksAgg.overdue}
                  prefix={<FireOutlined />}
                />
              )}
              <Text type="secondary">点击查看 Overdue</Text>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card hoverable style={kpiCardStyle} onClick={() => goCalendarToday("standard")}>
              {reservationsQuery.isLoading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title="今日日程"
                  value={reservationsAgg.todayCount}
                  prefix={<CalendarOutlined />}
                />
              )}
              <Text type="secondary">点击打开 Calendar（Today · Week）</Text>
            </Card>
          </Col>
        </Row>

        {/* ✅ Lists */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title="我的任务（Top 5）"
              extra={
                <Button
                  type="link"
                  onClick={() => goTasks("open")}
                  icon={<RightOutlined />}
                >
                  Open
                </Button>
              }
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <List
                  dataSource={myTasksList}
                  locale={{ emptyText: "暂无任务" }}
                  renderItem={(item) => (
                    <List.Item extra={item.extra}>
                      <List.Item.Meta title={item.title} description={item.desc} />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="今日日程（Top 5）"
              extra={
                <Space>
                  <Button
                    type="link"
                    onClick={() => goCalendarToday("standard")}
                    icon={<RightOutlined />}
                  >
                    Week
                  </Button>
                  <Button
                    type="link"
                    onClick={() => goCalendarToday("dnd")}
                    icon={<RightOutlined />}
                  >
                    DnD Day
                  </Button>
                </Space>
              }
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <List
                  dataSource={todayReservationsList}
                  locale={{ emptyText: "今日暂无预约" }}
                  renderItem={(item) => (
                    <List.Item extra={item.extra}>
                      <List.Item.Meta title={item.title} description={item.desc} />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
}