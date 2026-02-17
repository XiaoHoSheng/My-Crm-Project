import { useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import {
  deleteReservation,
  getReservations,
  updateReservation,
  type ReservationDto,
} from "@/api/reservations";
import { fetchCustomers } from "@/api/customers";

const STAFF_STORAGE_KEY = "crm_current_staff";
function getStoredStaff() {
  try {
    return (localStorage.getItem(STAFF_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}


const { Text, Title } = Typography;

// ✅ 用“本地时间字符串”，避免 UTC/Z 导致拖拽跑到前一天
function toLocalDateTimeString(d: Date) {
  return dayjs(d).format("YYYY-MM-DDTHH:mm:ss");
}

function parseToDayjs(s?: string | null) {
  if (!s) return null;
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

function overlap(aStart: dayjs.Dayjs, aEnd: dayjs.Dayjs, bStart: dayjs.Dayjs, bEnd: dayjs.Dayjs) {
  // 采用严格不等，允许“前一个结束==后一个开始”不算冲突
  return aStart.isBefore(bEnd) && aEnd.isAfter(bStart);
}

function normalizeEnd(start: dayjs.Dayjs, end?: dayjs.Dayjs | null) {
  return end && end.isValid() ? end : start;
}

export default function CalendarDnDView(props: { onSelectDate?: (d: dayjs.Dayjs) => void }) {
  const qc = useQueryClient();

  // 视图范围（用于拉取预约）
  const [range, setRange] = useState(() => {
    const start = dayjs().startOf("month").startOf("day");
    const end = dayjs().endOf("month").endOf("day");
    return {
      from: start.format("YYYY-MM-DDTHH:mm:ss"),
      to: end.format("YYYY-MM-DDTHH:mm:ss"),
    };
  });

  const { data, isFetching } = useQuery({
    queryKey: ["reservations-dnd", range],
    queryFn: () =>
      getReservations({
        page: 1,
        pageSize: 500,
        from: range.from,
        to: range.to,
      }),
  });

  const reservations = data?.items ?? [];

  // 便于 eventClick 快速找到 reservation
  const reservationMap = useMemo(() => {
    const m = new Map<number, ReservationDto>();
    for (const r of reservations) m.set(Number(r.id), r);
    return m;
  }, [reservations]);

  // ====== 冲突检测（前端快速检测）======
  const hasConflict = (args: { staff?: string | null; startAt: dayjs.Dayjs; endAt?: dayjs.Dayjs | null; excludeId?: number }) => {
    const staff = (args.staff ?? "").trim();
    if (!staff) return null; // 没有 staff 就不做冲突检测（避免误伤）

    const start = args.startAt;
    const end = normalizeEnd(start, args.endAt);
    const excludeId = args.excludeId ?? -1;

    for (const r of reservations) {
      if (Number(r.id) === excludeId) continue;
      if ((r.staff ?? "").trim() !== staff) continue;

      const rStart = parseToDayjs(r.startAt) ?? null;
      if (!rStart) continue;

      const rEnd = normalizeEnd(rStart, parseToDayjs(r.endAt));
      if (overlap(start, end, rStart, rEnd)) {
        return r;
      }
    }
    return null;
  };

  // ========== Drawer（点击事件后打开） ==========
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = useMemo(() => {
    if (!activeId) return null;
    return reservationMap.get(activeId) ?? null;
  }, [activeId, reservationMap]);

  const [form] = Form.useForm();

  // 客户下拉：远程搜索
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const timerRef = useRef<number | null>(null);

  const loadCustomerOptions = (q: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
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
    }, 250);
  };

  // ========== Mutations ==========
  const updateM = useMutation({
    mutationFn: async (args: { id: number; payload: any }) => updateReservation(args.id, args.payload),
    onSuccess: async () => {
      message.success("已保存");
      await qc.invalidateQueries({ queryKey: ["reservations"] });
      await qc.invalidateQueries({ queryKey: ["reservations-dnd"] });
    },
    onError: (e: any) => {
      console.error(e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.response?.data ?? e?.message;
      if (status === 409) {
        message.error(msg ? String(msg) : "时间冲突：该人员在此时间段已有预约");
        return;
      }
      message.error("保存失败（检查后端 PUT /api/reservations/{id}）");
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => deleteReservation(id),
    onSuccess: async () => {
      message.success("已删除预约");
      setDrawerOpen(false);
      setActiveId(null);
      await qc.invalidateQueries({ queryKey: ["reservations"] });
      await qc.invalidateQueries({ queryKey: ["reservations-dnd"] });
    },
    onError: (e: any) => {
      console.error(e);
      message.error("删除失败");
    },
  });

  // ========== FullCalendar events ==========
  const events = useMemo(() => {
    return reservations
      .map((x) => ({
        id: String(x.id),
        title: `${x.title || "（无标题）"}${x.customerName ? ` · ${x.customerName}` : ""}`,
        start: x.startAt || x.createdAt || undefined,
        end: x.endAt || undefined,
        allDay: false,
      }))
      .filter((e) => !!e.start);
  }, [reservations]);

  // 打开抽屉并填充表单
  const openDrawerFor = (id: number) => {
    const r = reservationMap.get(id);
    if (!r) {
      message.warning("未找到该预约（可能不在当前范围内）");
      return;
    }

    setActiveId(id);
    setDrawerOpen(true);

    // 预加载客户选项（保证当前 customerId 能显示 label）
    if (r.customerId) {
      setCustomerOptions((prev) => {
        const exists = prev.some((x) => x.value === r.customerId);
        if (exists) return prev;
        const label = r.customerName ? `${r.customerName} (#${r.customerId})` : `#${r.customerId}`;
        return [{ label, value: r.customerId }, ...prev];
      });
    }

    form.setFieldsValue({
      customerId: r.customerId,
      title: r.title ?? "",
      staff: r.staff ?? "",
      content: r.content ?? "",
      startAt: parseToDayjs(r.startAt) ?? dayjs(),
      endAt: parseToDayjs(r.endAt),
    });
  };

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <span>拖拽 / 拉伸视图（企业级）</span>
            {isFetching ? <Tag>Loading</Tag> : null}
          </Space>
        }
        extra={
          <Text type="secondary">
            拖拽改期 / 拉伸改时长（end_time） · ✅ 冲突检测（同一人员时间重叠会拦截） · 点击事件可编辑
          </Text>
        }
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          timeZone="local"
          events={events}
          editable
          eventDurationEditable
          eventStartEditable
          eventDrop={(info) => {
            const id = Number(info.event.id);
            const start = info.event.start;
            const end = info.event.end;
            if (!start) return;

            const base = reservationMap.get(id);
            const staff = base?.staff ?? null;

            const startD = dayjs(start);
            const endD = end ? dayjs(end) : null;

            const conflict = hasConflict({ staff, startAt: startD, endAt: endD, excludeId: id });
            if (conflict) {
              info.revert();
              message.error(
                `时间冲突：${staff} 在 ${dayjs(conflict.startAt).format("YYYY-MM-DD HH:mm")} 已有预约（ID #${conflict.id}）`
              );
              return;
            }

            updateM.mutate({
              id,
              payload: {
                startAt: toLocalDateTimeString(start),
                endAt: end ? toLocalDateTimeString(end) : null,
              },
            });

            props.onSelectDate?.(dayjs(start));
          }}
          eventResize={(info) => {
            const id = Number(info.event.id);
            const start = info.event.start;
            const end = info.event.end;
            if (!start) return;

            const base = reservationMap.get(id);
            const staff = base?.staff ?? null;

            const startD = dayjs(start);
            const endD = end ? dayjs(end) : null;

            const conflict = hasConflict({ staff, startAt: startD, endAt: endD, excludeId: id });
            if (conflict) {
              info.revert();
              message.error(
                `时间冲突：${staff} 在 ${dayjs(conflict.startAt).format("YYYY-MM-DD HH:mm")} 已有预约（ID #${conflict.id}）`
              );
              return;
            }

            updateM.mutate({
              id,
              payload: {
                startAt: toLocalDateTimeString(start),
                endAt: end ? toLocalDateTimeString(end) : null,
              },
            });

            props.onSelectDate?.(dayjs(start));
          }}
          dateClick={(info) => {
            props.onSelectDate?.(dayjs(info.date));
          }}
          eventClick={(info) => {
            const id = Number(info.event.id);
            const start = info.event.start;
            if (start) props.onSelectDate?.(dayjs(start));

            openDrawerFor(id);
          }}
          datesSet={(arg) => {
            const from = dayjs(arg.start).startOf("day").format("YYYY-MM-DDTHH:mm:ss");
            const to = dayjs(arg.end).endOf("day").format("YYYY-MM-DDTHH:mm:ss");
            setRange({ from, to });
          }}
          height="auto"
        />
      </Card>

      <Drawer
        title="预约详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        destroyOnClose
        extra={
          <Space>
            {active?.customerId ? (
              <Button type="link" href={`/customers/${active.customerId}`}>
                打开客户
              </Button>
            ) : null}
            {activeId ? (
              <Popconfirm
                title="确认删除这条预约？"
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => deleteM.mutate(activeId)}
              >
                <Button danger loading={deleteM.isPending}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
      >
        {!active ? (
          <Text type="secondary">未选择预约</Text>
        ) : (
          <>
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Title level={5} style={{ margin: 0 }}>
                {active.title || "（无标题）"}
              </Title>
              <Text type="secondary">
                ID: #{active.id} · 客户：{" "}
                {active.customerId ? (
                  <Link to={`/customers/${active.customerId}`}>
                    {active.customerName ?? `#${active.customerId}`}
                  </Link>
                ) : (
                  "-"
                )}
              </Text>
            </Space>

            <Divider style={{ margin: "12px 0" }} />

            <Form
              form={form}
              layout="vertical"
              onFinish={(v) => {
                if (!activeId) return;

                const start: dayjs.Dayjs = v.startAt;
                const end: dayjs.Dayjs | null = v.endAt ?? null;
                const staff = (v.staff ?? "").trim() || null;

                const conflict = hasConflict({ staff, startAt: start, endAt: end, excludeId: activeId });
                if (conflict) {
                  message.error(
                    `时间冲突：${staff} 在 ${dayjs(conflict.startAt).format("YYYY-MM-DD HH:mm")} 已有预约（ID #${conflict.id}）`
                  );
                  return;
                }

                updateM.mutate({
                  id: activeId,
                  payload: {
                    customerId: Number(v.customerId),
                    title: (v.title ?? "").trim() || null,
                    staff,
                    content: (v.content ?? "").trim() || null,
                    startAt: start ? start.format("YYYY-MM-DDTHH:mm:ss") : null,
                    endAt: end ? end.format("YYYY-MM-DDTHH:mm:ss") : null,
                  },
                });
              }}
            >
              <Form.Item name="customerId" label="客户" rules={[{ required: true, message: "请选择客户" }]}>
                <Select
                  showSearch
                  allowClear
                  placeholder="搜索客户"
                  options={customerOptions}
                  onSearch={loadCustomerOptions}
                  filterOption={false}
                />
              </Form.Item>

              <Form.Item name="title" label="主题">
                <Input placeholder="例如：回访 / 面谈 / 会议" />
              </Form.Item>

              <Form.Item name="staff" label="负责人 / Staff">
                <Input placeholder="例如：Jason（或员工ID）" />
              </Form.Item>

              <Form.Item name="startAt" label="开始时间" rules={[{ required: true, message: "请选择开始时间" }]}>
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item name="endAt" label="结束时间（可选）">
                <DatePicker showTime style={{ width: "100%" }} allowClear />
              </Form.Item>

              <Form.Item name="content" label="备注">
                <Input.TextArea rows={5} placeholder="补充说明..." />
              </Form.Item>

              <Space style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={() => setDrawerOpen(false)}>关闭</Button>
                <Button type="primary" htmlType="submit" loading={updateM.isPending}>
                  保存
                </Button>
              </Space>
            </Form>

            <Divider style={{ margin: "12px 0" }} />
            <Text type="secondary">
              提示：前端会先做冲突检测；后端也会做最终拦截（返回 409）。
            </Text>
          </>
        )}
      </Drawer>
    </>
  );
}