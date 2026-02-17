import { useEffect, useMemo, useState } from "react";
import { Card, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import { getReservations, updateReservation } from "@/api/reservations";

const { Title, Text } = Typography;

// ✅ 关键：用“本地时间字符串”，不要 toISOString()（UTC 会导致前一天）
function toLocalDateTimeString(d: Date) {
  return dayjs(d).format("YYYY-MM-DDTHH:mm:ss");
}

function parseDateParam(v: string | null) {
  if (!v) return null;
  if (v === "today") return dayjs();
  const d1 = dayjs(v, "YYYY-MM-DD", true);
  if (d1.isValid()) return d1;
  const d2 = dayjs(v);
  return d2.isValid() ? d2 : null;
}

type FcView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";
function mapSimpleView(v: string | null): FcView {
  const x = (v ?? "").toLowerCase();
  if (x === "month") return "dayGridMonth";
  if (x === "day") return "timeGridDay";
  return "timeGridWeek"; // default week
}

export default function CalendarPageDnD() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  const initialDate = useMemo(() => parseDateParam(sp.get("date")) ?? dayjs(), [sp]);
  const initialView = useMemo(() => mapSimpleView(sp.get("view")), [sp]);

  // ✅ from/to 用本地字符串，不要 toISOString()
  const [range, setRange] = useState(() => {
    const start = initialDate.startOf("month").startOf("day");
    const end = initialDate.endOf("month").endOf("day");
    return {
      from: start.format("YYYY-MM-DDTHH:mm:ss"),
      to: end.format("YYYY-MM-DDTHH:mm:ss"),
    };
  });

  // 当 URL date 变化时，刷新范围到对应月份
  useEffect(() => {
    const start = initialDate.startOf("month").startOf("day");
    const end = initialDate.endOf("month").endOf("day");
    setRange({
      from: start.format("YYYY-MM-DDTHH:mm:ss"),
      to: end.format("YYYY-MM-DDTHH:mm:ss"),
    });
  }, [initialDate]);

  const { data, isFetching } = useQuery({
    queryKey: ["reservations", range],
    queryFn: () =>
      getReservations({
        page: 1,
        pageSize: 500,
        from: range.from,
        to: range.to,
      }),
  });

  const updateM = useMutation({
    mutationFn: async (args: { id: number; startAt?: string; endAt?: string | null }) =>
      updateReservation(args.id, {
        startAt: args.startAt,
        endAt: args.endAt ?? null,
      }),
    onSuccess: async () => {
      message.success("已更新日程时间");
      await qc.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (e: any) => {
      console.error(e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.response?.data ?? e?.message;
      if (status === 409) {
        message.error(msg ? String(msg) : "时间冲突：该人员在此时间段已有预约");
        return;
      }
      message.error("更新失败（检查后端 PUT /api/reservations/{id}）");
    },
  });

  const events = useMemo(() => {
    const items = data?.items ?? [];
    return items
      .map((x) => ({
        id: String(x.id),
        title: `${x.title || "（无标题）"}${x.customerName ? ` · ${x.customerName}` : ""}`,
        start: x.startAt || x.createdAt || undefined,
        end: x.endAt || undefined,
        allDay: false,
      }))
      .filter((e) => !!e.start);
  }, [data]);

  const setDateParam = (d: dayjs.Dayjs) => {
    const next = new URLSearchParams(sp);
    next.set("date", d.format("YYYY-MM-DD"));
    setSp(next, { replace: true });
  };

  const setViewParam = (v: "month" | "week" | "day") => {
    const next = new URLSearchParams(sp);
    next.set("view", v);
    setSp(next, { replace: true });
  };

  return (
    <div style={{ padding: 16 }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={2}>
          <Title level={3} style={{ margin: 0 }}>
            Calendar（拖拽 / 拉伸版）
          </Title>
          <Text type="secondary">
            ✅ 支持 URL：?date=today|YYYY-MM-DD · ?view=month|week|day · ✅ local 时区 + 本地时间字符串保存
          </Text>
        </Space>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <span>日历</span>
            {isFetching ? <Tag>Loading</Tag> : null}
            <Tag color="blue">{initialDate.format("YYYY-MM-DD")}</Tag>
            <Tag>{initialView}</Tag>
          </Space>
        }
      >
        <FullCalendar
          key={`${initialDate.format("YYYY-MM-DD")}-${initialView}`}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={initialView}
          initialDate={initialDate.toDate()}
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

            updateM.mutate({
              id,
              startAt: toLocalDateTimeString(start),
              endAt: end ? toLocalDateTimeString(end) : null,
            });
            setDateParam(dayjs(start));
          }}
          eventResize={(info) => {
            const id = Number(info.event.id);
            const start = info.event.start;
            const end = info.event.end;
            if (!start) return;

            updateM.mutate({
              id,
              startAt: toLocalDateTimeString(start),
              endAt: end ? toLocalDateTimeString(end) : null,
            });
            setDateParam(dayjs(start));
          }}
          dateClick={(info) => setDateParam(dayjs(info.date))}
          datesSet={(arg) => {
            const from = dayjs(arg.start).startOf("day").format("YYYY-MM-DDTHH:mm:ss");
            const to = dayjs(arg.end).endOf("day").format("YYYY-MM-DDTHH:mm:ss");
            setRange({ from, to });

            // 同步 URL date（定位到当前视图起始日即可）
            setDateParam(dayjs(arg.start));
          }}
          viewDidMount={(arg) => {
            // 初次挂载时同步 view
            const v = arg.view.type;
            if (v === "dayGridMonth") setViewParam("month");
            else if (v === "timeGridDay") setViewParam("day");
            else setViewParam("week");
          }}
          viewWillUnmount={() => {}}
          height="auto"
        />
      </Card>
    </div>
  );
}
