// src/pages/customers/ActivitiesTimelineTab.tsx
import { useMemo, useState } from "react";
import { Button, DatePicker, Input, Pagination, Select, Space, Tag, Timeline, Typography } from "antd";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";

import { getCustomerActivities, type ActivitiesType, type ActivityDto } from "@/api/activities";

const { RangePicker } = DatePicker;
const { Text } = Typography;

function fmt(dt?: string | null) {
  if (!dt) return "-";
  const d = dayjs(dt);
  return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : String(dt);
}

function SourceTag(row: ActivityDto) {
  if (row.source === "note") return <Tag color="green">NOTE</Tag>;
  const label = row.eventCharacter || row.title || "EVENT";
  return <Tag color="blue">{String(label).toUpperCase()}</Tag>;
}

export default function ActivitiesTimelineTab({ customerId }: { customerId: number }) {
  const [type, setType] = useState<ActivitiesType>("all");
  const [keyword, setKeyword] = useState("");
  const [staff, setStaff] = useState("");
  const [eventCharacter, setEventCharacter] = useState("");

  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = useMemo(() => {
    const from = range[0] ? range[0].toISOString() : undefined;
    const to = range[1] ? range[1].toISOString() : undefined;

    return {
      customerId,
      page,
      pageSize,
      type,
      keyword: keyword.trim() || undefined,
      staff: staff.trim() || undefined,
      eventCharacter: eventCharacter.trim() || undefined,
      from,
      to,
    };
  }, [customerId, page, pageSize, type, keyword, staff, eventCharacter, range]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["customer_activities", params],
    queryFn: () => getCustomerActivities(params),
    staleTime: 0,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const timelineItems = useMemo(() => {
    return items.map((row) => {
      const header = (
        <Space size={8} wrap>
          <Text style={{ whiteSpace: "nowrap" }}>{fmt(row.time)}</Text>
          {SourceTag(row)}
          {row.source === "event" && row.staff ? (
            <Tag>{row.staff}</Tag>
          ) : null}
          {row.title ? (
            <Text type="secondary" ellipsis={{ tooltip: row.title }}>
              {row.title}
            </Text>
          ) : null}
        </Space>
      );

      const body = row.content ? (
        <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{row.content}</div>
      ) : (
        <div style={{ marginTop: 6, color: "#999" }}>（无内容）</div>
      );

      return {
        children: (
          <div>
            {header}
            {body}
          </div>
        ),
      };
    });
  }, [items]);

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {/* Filters */}
      <Space wrap style={{ width: "100%" }}>
        <Select<ActivitiesType>
          value={type}
          style={{ width: 140 }}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "events", label: "Events" },
            { value: "notes", label: "Notes" },
          ]}
        />

        <Input
          placeholder="关键字（内容/主题/客户名）"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ width: 260, maxWidth: "100%" }}
        />

        <RangePicker
          value={range}
          showTime
          onChange={(v) => {
            const a = v?.[0] ?? null;
            const b = v?.[1] ?? null;
            setRange([a, b]);
            setPage(1);
          }}
        />

        <Input
          placeholder="staff（仅 Events）"
          value={staff}
          onChange={(e) => {
            setStaff(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ width: 180, maxWidth: "100%" }}
        />

        <Input
          placeholder="eventCharacter（仅 Events）"
          value={eventCharacter}
          onChange={(e) => {
            setEventCharacter(e.target.value);
            setPage(1);
          }}
          allowClear
          style={{ width: 210, maxWidth: "100%" }}
        />

        <Button
          onClick={() => {
            setPage(1);
            refetch();
          }}
          loading={isFetching}
        >
          刷新
        </Button>

        <Button
          onClick={() => {
            setType("all");
            setKeyword("");
            setRange([null, null]);
            setStaff("");
            setEventCharacter("");
            setPage(1);
            setPageSize(10);
          }}
        >
          重置
        </Button>
      </Space>

      {/* Timeline */}
      <Timeline items={timelineItems as any} />

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
        />
      </div>
    </Space>
  );
}
