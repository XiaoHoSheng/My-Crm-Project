import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Input,
  List,
  Popconfirm,
  Row,
  Col,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";

import { getCustomerById } from "../../api/customers";
import {
  fetchCustomerNotes,
  createCustomerNote,
  deleteCustomerNote,
  type CustomerNote,
} from "../../api/customerNotes";

import ContactsTab from "./ContactsTab";
import EventsTab from "./EventsTab";
import TasksTab from "./TasksTab";

import { fetchContacts } from "@/api/contacts";
import { getCustomerEvents } from "../../api/events";
import { getTasks } from "@/api/tasks";

type TaskFilter = "all" | "overdue" | "due3" | "due7";

type CustomerDto = {
  id: number;
  customerId: number;
  grade?: string | null;
  name?: string | null;
  registrationTime?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customerTypeId?: number | null;
  customerTypeName?: string | null;
};

type OverviewStats = {
  tasksTotal: number | null;
  contactsTotal: number | null;
  eventsTotal: number | null;
  notesTotal: number | null;

  lastTouchAt: string | null;
  lastTouchType: "备注" | "事件" | null;
  lastTouchText: string | null;

  notes7d: number | null;
  events7d: number | null;

  // ✅ 待办提醒
  tasksOverdue: number | null;
  tasksDue3: number | null;
  tasksDue7: number | null;
};

function formatDateTime(v?: string | null) {
  if (!v) return "";
  if (v.includes("T")) return v.replace("T", " ").slice(0, 16);
  return v;
}

function pickTotal(x: any): number | null {
  const n = Number(x?.total ?? x?.Total);
  return Number.isFinite(n) ? n : null;
}

function isTruthyText(s?: string | null) {
  return !!(s && s.trim());
}

function pickTaskDue(task: any): string | null {
  const v = task?.dueAt ?? task?.dueDate ?? task?.deadline ?? task?.endDate ?? task?.endTime ?? null;
  return typeof v === "string" && v.trim() ? v : null;
}

function isTaskDone(task: any): boolean {
  const s = String(task?.status ?? "").toLowerCase();
  return s === "done" || s === "completed" || s === "finish" || s === "finished" || s === "已完成" || s === "完成";
}

function pickEventTime(ev: any): string | null {
  const candidates = [ev?.eventTime, ev?.time, ev?.createdAt, ev?.createTime];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const numId = useMemo(() => Number(id), [id]);
  const isValidId = useMemo(() => Number.isFinite(numId) && numId > 0, [numId]);

  const tabKey = useMemo(() => `customer-detail-tab-${numId}`, [numId]);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem(`customer-detail-tab-${Number(id)}`) || "overview";
    } catch {
      return "overview";
    }
  });

  // ✅ 任务过滤：由 Overview 点击控制
  const [tasksFilter, setTasksFilter] = useState<TaskFilter>("all");

  useEffect(() => {
    if (!isValidId) {
      setActiveTab("overview");
      return;
    }
    try {
      setActiveTab(localStorage.getItem(tabKey) || "overview");
    } catch {
      setActiveTab("overview");
    }
  }, [tabKey, isValidId]);

  const [data, setData] = useState<CustomerDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const [ov, setOv] = useState<OverviewStats>({
    tasksTotal: null,
    contactsTotal: null,
    eventsTotal: null,
    notesTotal: null,
    lastTouchAt: null,
    lastTouchType: null,
    lastTouchText: null,
    notes7d: null,
    events7d: null,
    tasksOverdue: null,
    tasksDue3: null,
    tasksDue7: null,
  });
  const [ovLoading, setOvLoading] = useState(false);

  const loadCustomer = async () => {
    if (!isValidId) {
      setData(null);
      setError("Invalid customer id");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await getCustomerById<CustomerDto>(numId);
      setData(res);
    } catch (e: any) {
      console.error(e);
      setData(null);
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!isValidId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    try {
      const list = await fetchCustomerNotes(numId);
      setNotes(list);
    } catch (e) {
      console.error(e);
      message.error("加载备注失败（检查 notes 接口）");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const loadOverview = async () => {
    if (!isValidId) return;

    setOvLoading(true);
    try {
      const now = dayjs();
      const since7 = now.subtract(7, "day");

      const notesTotal = Array.isArray(notes) ? notes.length : null;
      const notes7d =
        Array.isArray(notes) ? notes.filter((n) => dayjs(n.createdAt).isAfter(since7)).length : null;

      // 为了统计到期：拉 200 条客户任务（你客户任务一般不会超过这个）
      const [tasksRes, tasksBigRes, contactsRes, eventsBigRes] = await Promise.allSettled([
        (getTasks as any)({ customerId: numId, page: 1, pageSize: 1 }),
        (getTasks as any)({ customerId: numId, page: 1, pageSize: 200 }),
        fetchContacts({ customerId: numId, page: 1, pageSize: 1 }),
        getCustomerEvents({ customerId: numId, page: 1, pageSize: 200 }),
      ]);

      const tasksTotal = tasksRes.status === "fulfilled" ? pickTotal(tasksRes.value) : null;
      const contactsTotal = contactsRes.status === "fulfilled" ? pickTotal(contactsRes.value) : null;

      // events
      let eventsTotal: number | null = null;
      let events7d: number | null = null;
      let latestEventTime: dayjs.Dayjs | null = null;
      let latestEventText: string | null = null;

      if (eventsBigRes.status === "fulfilled") {
        const total = pickTotal(eventsBigRes.value);
        if (total !== null) eventsTotal = total;

        const items = (eventsBigRes.value as any)?.items ?? (eventsBigRes.value as any)?.Items ?? [];
        if (Array.isArray(items)) {
          events7d = items.filter((ev: any) => {
            const t = pickEventTime(ev);
            return t ? dayjs(t).isAfter(since7) : false;
          }).length;

          const first = items[0];
          const et = pickEventTime(first);
          if (et) latestEventTime = dayjs(et);
          latestEventText = first?.theme || first?.content || first?.remark || null;
        }
      }

      // ✅ tasks overdue/due3/due7
      let tasksOverdue: number | null = null;
      let tasksDue3: number | null = null;
      let tasksDue7: number | null = null;

      if (tasksBigRes.status === "fulfilled") {
        const items = (tasksBigRes.value as any)?.items ?? (tasksBigRes.value as any)?.Items ?? [];
        if (Array.isArray(items)) {
          const overdue = items.filter((t: any) => {
            if (isTaskDone(t)) return false;
            const due = pickTaskDue(t);
            if (!due) return false;
            const d = dayjs(due);
            return d.isValid() && d.isBefore(now);
          }).length;

          const due3 = items.filter((t: any) => {
            if (isTaskDone(t)) return false;
            const due = pickTaskDue(t);
            if (!due) return false;
            const d = dayjs(due);
            return d.isValid() && d.isAfter(now) && d.isBefore(now.add(3, "day"));
          }).length;

          const due7 = items.filter((t: any) => {
            if (isTaskDone(t)) return false;
            const due = pickTaskDue(t);
            if (!due) return false;
            const d = dayjs(due);
            return d.isValid() && d.isAfter(now) && d.isBefore(now.add(7, "day"));
          }).length;

          tasksOverdue = overdue;
          tasksDue3 = due3;
          tasksDue7 = due7;
        }
      }

      // 最近触达：备注 vs 事件
      const latestNote = notes?.[0];
      const noteTime = latestNote?.createdAt ? dayjs(latestNote.createdAt) : null;

      let lastTouchAt: string | null = null;
      let lastTouchType: OverviewStats["lastTouchType"] = null;
      let lastTouchText: string | null = null;

      if (noteTime && latestEventTime) {
        if (noteTime.isAfter(latestEventTime)) {
          lastTouchAt = noteTime.format("YYYY-MM-DD HH:mm");
          lastTouchType = "备注";
          lastTouchText = latestNote?.content ?? null;
        } else {
          lastTouchAt = latestEventTime.format("YYYY-MM-DD HH:mm");
          lastTouchType = "事件";
          lastTouchText = latestEventText;
        }
      } else if (noteTime) {
        lastTouchAt = noteTime.format("YYYY-MM-DD HH:mm");
        lastTouchType = "备注";
        lastTouchText = latestNote?.content ?? null;
      } else if (latestEventTime) {
        lastTouchAt = latestEventTime.format("YYYY-MM-DD HH:mm");
        lastTouchType = "事件";
        lastTouchText = latestEventText;
      }

      setOv({
        tasksTotal,
        contactsTotal,
        eventsTotal,
        notesTotal,
        lastTouchAt,
        lastTouchType,
        lastTouchText,
        notes7d,
        events7d,
        tasksOverdue,
        tasksDue3,
        tasksDue7,
      });
    } catch (e) {
      console.error(e);
      setOv((prev) => ({
        ...prev,
        notesTotal: Array.isArray(notes) ? notes.length : prev.notesTotal,
        notes7d: Array.isArray(notes)
          ? notes.filter((n) => dayjs(n.createdAt).isAfter(dayjs().subtract(7, "day"))).length
          : prev.notes7d,
      }));
    } finally {
      setOvLoading(false);
    }
  };

  const refreshAll = async () => {
    await loadCustomer();
    await loadNotes();
    await loadOverview();
  };

  const handleAddNote = async () => {
    const content = noteText.trim();
    if (!content) return message.warning("请输入备注内容");
    if (!isValidId) return message.error("客户ID无效，无法添加备注");

    setNoteSaving(true);
    try {
      const created = await createCustomerNote(numId, content);
      message.success("备注已添加");
      setNoteText("");
      setNotes((prev) => [created, ...prev]);
      setTimeout(() => loadOverview(), 0);
    } catch (e) {
      console.error(e);
      message.error("添加备注失败");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!isValidId) return;
    try {
      await deleteCustomerNote(numId, noteId);
      message.success("备注已删除");
      setNotes((prev) => prev.filter((x) => x.id !== noteId));
      setTimeout(() => loadOverview(), 0);
    } catch (e) {
      console.error(e);
      message.error("删除备注失败");
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const completeness = useMemo(() => {
    const missing: { key: string; label: string }[] = [];
    if (!data) return { score: 0, missing };

    if (!isTruthyText(data.contactPerson)) missing.push({ key: "contactPerson", label: "缺联系人" });
    if (!isTruthyText(data.phone)) missing.push({ key: "phone", label: "缺电话" });
    if (!isTruthyText(data.email)) missing.push({ key: "email", label: "缺邮箱" });
    if (!isTruthyText(data.address)) missing.push({ key: "address", label: "缺地址" });
    if (!data.customerTypeId) missing.push({ key: "type", label: "缺客户类型" });

    const total = 5;
    const ok = total - missing.length;
    const score = Math.round((ok / total) * 100);

    return { score, missing };
  }, [data]);

  const jumpToTasks = (filter: TaskFilter) => {
    setTasksFilter(filter);
    setActiveTab("tasks");
    try {
      localStorage.setItem(tabKey, "tasks");
    } catch {}
  };

  const OverviewPanel = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Card size="small" title="信息完整度">
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              完整度：<b>{data ? `${completeness.score}%` : "--"}</b>
              <span style={{ color: "#888", marginLeft: 8 }}>（建议补全关键信息便于触达/筛选）</span>
            </div>

            <Button size="small" type="primary" onClick={() => navigate(`/customers/${id}/edit?returnTo=detail`)}>
              去补全
            </Button>
          </div>

          {data && completeness.missing.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message="发现缺失字段"
              description={
                <Space wrap>
                  {completeness.missing.map((m) => (
                    <Tag key={m.key} color="orange">
                      {m.label}
                    </Tag>
                  ))}
                </Space>
              }
            />
          ) : data ? (
            <Alert type="success" showIcon message="信息已较完整" />
          ) : null}
        </Space>
      </Card>

      {/* ✅ 新增：待办提醒（可点击联动） */}
      <Card
        size="small"
        title="待办提醒"
        extra={
          <Button size="small" onClick={loadOverview} loading={ovLoading}>
            刷新
          </Button>
        }
      >
        <Row gutter={[12, 12]}>
          <Col xs={8} sm={8} md={8}>
            <div style={{ cursor: "pointer" }} onClick={() => jumpToTasks("overdue")}>
              <Statistic title="超期未完成" value={ov.tasksOverdue ?? "--"} loading={ovLoading} />
            </div>
          </Col>
          <Col xs={8} sm={8} md={8}>
            <div style={{ cursor: "pointer" }} onClick={() => jumpToTasks("due3")}>
              <Statistic title="3 天内到期" value={ov.tasksDue3 ?? "--"} loading={ovLoading} />
            </div>
          </Col>
          <Col xs={8} sm={8} md={8}>
            <div style={{ cursor: "pointer" }} onClick={() => jumpToTasks("due7")}>
              <Statistic title="7 天内到期" value={ov.tasksDue7 ?? "--"} loading={ovLoading} />
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 8, color: "#888" }}>
          点击数字可直接跳到「待办」并自动筛选（超期 / 3天内 / 7天内）。
        </div>
      </Card>

      <Card size="small" title="最近 7 天">
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} md={8}>
            <Statistic title="新增备注" value={ov.notes7d ?? "--"} loading={ovLoading} />
          </Col>
          <Col xs={12} sm={12} md={8}>
            <Statistic title="新增事件" value={ov.events7d ?? "--"} loading={ovLoading} />
          </Col>
          <Col xs={12} sm={12} md={8}>
            <Statistic title="（待办提醒见上方）" value=" " />
          </Col>
        </Row>
      </Card>

      <Card size="small" title="关键指标">
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} md={6}>
            <Statistic title="待办总数" value={ov.tasksTotal ?? "--"} loading={ovLoading} />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Statistic title="联系人数量" value={ov.contactsTotal ?? "--"} loading={ovLoading} />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Statistic title="往来事件数量" value={ov.eventsTotal ?? "--"} loading={ovLoading} />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Statistic title="备注数量" value={ov.notesTotal ?? "--"} loading={ovLoading} />
          </Col>
        </Row>
      </Card>

      <Card size="small" title="最近触达">
        {ov.lastTouchAt ? (
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <div>
              <Tag>{ov.lastTouchType}</Tag>
              <span style={{ color: "#666" }}>{ov.lastTouchAt}</span>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {ov.lastTouchText ? ov.lastTouchText : <span style={{ color: "#999" }}>（无内容）</span>}
            </div>
          </Space>
        ) : (
          <div style={{ color: "#999" }}>暂无触达记录</div>
        )}
      </Card>

      <Card size="small" title="快捷操作">
        <Space wrap>
          <Button type="primary" onClick={() => setActiveTab("notes")}>
            写备注
          </Button>
          <Button onClick={() => jumpToTasks("all")}>看待办</Button>
          <Button onClick={() => setActiveTab("contacts")}>看联系人</Button>
          <Button onClick={() => setActiveTab("events")}>看事件</Button>
        </Space>
      </Card>
    </Space>
  );

  return (
    <div className="app-container">
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            客户详情
          </Typography.Title>

          <Space>
            <Button onClick={() => navigate("/customers")}>返回列表</Button>
            <Button onClick={refreshAll} loading={loading || notesLoading || ovLoading}>
              刷新
            </Button>

            <Button type="primary" onClick={() => navigate(`/customers/${id}/edit?returnTo=detail`)} disabled={!isValidId}>
              编辑
            </Button>
          </Space>
        </Space>

        {!isValidId ? <Alert type="error" showIcon message="客户ID无效" description={`当前 id = ${String(id)}`} /> : null}
        {error ? <Alert type="error" showIcon message="加载客户失败" description={error} /> : null}

        {loading ? (
          <div style={{ padding: 24 }}>
            <Spin />
          </div>
        ) : null}

        {!loading && data ? (
          <>
            <Card title="客户资料" size="small">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
                <Descriptions.Item label="客户编号">{data.customerId}</Descriptions.Item>

                <Descriptions.Item label="客户名称">{data.name ?? ""}</Descriptions.Item>
                <Descriptions.Item label="等级">{data.grade ? <Tag>{data.grade}</Tag> : ""}</Descriptions.Item>

                <Descriptions.Item label="联系人">{data.contactPerson ?? ""}</Descriptions.Item>
                <Descriptions.Item label="电话">{data.phone ?? ""}</Descriptions.Item>

                <Descriptions.Item label="邮箱" span={2}>
                  {data.email ?? ""}
                </Descriptions.Item>

                <Descriptions.Item label="客户类型">{data.customerTypeName ?? ""}</Descriptions.Item>
                <Descriptions.Item label="注册时间">{formatDateTime(data.registrationTime)}</Descriptions.Item>

                <Descriptions.Item label="地址" span={2}>
                  {data.address ?? ""}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider />

            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                try {
                  localStorage.setItem(tabKey, key);
                } catch {}
              }}
              items={[
                { key: "overview", label: "概览", children: OverviewPanel },
                {
                  key: "notes",
                  label: "跟进记录 / 备注",
                  children: (
                    <Card title="跟进记录 / 备注" size="small">
                      <Input.TextArea
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="写一条跟进记录..."
                      />

                      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <Button type="primary" loading={noteSaving} onClick={handleAddNote}>
                          添加备注
                        </Button>
                        <Button loading={notesLoading} onClick={loadNotes}>
                          刷新备注
                        </Button>
                      </div>

                      <Divider style={{ margin: "12px 0" }} />

                      <List
                        loading={notesLoading}
                        dataSource={notes}
                        locale={{ emptyText: "暂无备注" }}
                        renderItem={(item) => (
                          <List.Item
                            actions={[
                              <Popconfirm
                                key="del"
                                title="确认删除这条备注？"
                                okText="删除"
                                okButtonProps={{ danger: true }}
                                cancelText="取消"
                                onConfirm={() => handleDeleteNote(item.id)}
                              >
                                <a style={{ color: "#ff4d4f" }}>删除</a>
                              </Popconfirm>,
                            ]}
                          >
                            <List.Item.Meta title={dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")} description={item.content} />
                          </List.Item>
                        )}
                      />
                    </Card>
                  ),
                },

                
                { key: "tasks", label: "待办", children: <TasksTab customerId={numId} filter={tasksFilter} /> },

                { key: "contacts", label: "联系人", children: <ContactsTab customerId={numId} /> },
                { key: "events", label: "往来事件", children: <EventsTab customerId={numId} /> },
              ]}
            />
          </>
        ) : null}
      </Space>
    </div>
  );
}
