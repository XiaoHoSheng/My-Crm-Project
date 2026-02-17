import { Button, DatePicker, Form, Input, message, Modal, Popconfirm, Space, Table, Tag, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  createCustomerEvent,
  deleteEvent,
  getCustomerEvents,
  updateEvent,
  type EventRecord,
} from "../../api/events";

const { TextArea } = Input;

const EVENT_TYPES = [
  { value: "CALL", label: "电话" },
  { value: "MEETING", label: "会议" },
  { value: "VISIT", label: "拜访" },
  { value: "EMAIL", label: "邮件" },
  { value: "WECHAT", label: "微信" },
];

export default function EventsTab({ customerId }: { customerId: number }) {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ["customerEvents", customerId, page, pageSize, keyword],
    queryFn: () =>
      getCustomerEvents({
        customerId,
        page,
        pageSize,
        keyword: keyword.trim() || undefined,
      }),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({
      predicate: (x) =>
        Array.isArray(x.queryKey) &&
        x.queryKey[0] === "customerEvents" &&
        x.queryKey[1] === customerId,
    });
  };

  const createM = useMutation({
    mutationFn: (payload: Partial<EventRecord>) => createCustomerEvent(customerId, payload),
    onSuccess: async () => {
      message.success("已新增事件");
      await invalidate();
      setOpen(false);
      form.resetFields();
    },
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EventRecord> }) =>
      updateEvent(id, payload),
    onSuccess: async () => {
      message.success("已更新事件");
      await invalidate();
      setOpen(false);
      setEditing(null);
      form.resetFields();
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: async () => {
      message.success("已删除事件");
      await invalidate();
    },
  });

  const columns: ColumnsType<EventRecord> = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "eventTime",
        width: 180,
        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "-"),
      },
      {
        title: "类型",
        dataIndex: "eventCharacter",
        width: 120,
        render: (v) => (v ? <Tag>{v}</Tag> : "-"),
      },
      { title: "人员", dataIndex: "staff", width: 120, render: (v) => v || "-" },
      { title: "主题", dataIndex: "theme", width: 200, ellipsis: true },
      { title: "内容", dataIndex: "content", ellipsis: true },
      {
        title: "操作",
        width: 160,
        render: (_, row) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setEditing(row);
                setOpen(true);
                form.setFieldsValue({
                  eventTime: row.eventTime ? dayjs(row.eventTime) : dayjs(),
                  eventCharacter: row.eventCharacter,
                  staff: row.staff,
                  theme: row.theme,
                  content: row.content,
                });
              }}
            >
              编辑
            </Button>

            <Popconfirm title="确定删除？" onConfirm={() => deleteM.mutate(row.id)}>
              <Button size="small" danger loading={deleteM.isPending}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteM.isPending, form]
  );

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Space>
          <Input
            placeholder="搜索主题 / 内容 / 人员"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
            style={{ width: 260 }}
            allowClear
          />

          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
              form.setFieldsValue({ eventTime: dayjs() });
            }}
          >
            新增事件
          </Button>
        </Space>

        <span style={{ color: "#888" }}>共 {q.data?.total ?? 0} 条</span>
      </Space>

      <Table
        rowKey="id"
        loading={q.isLoading}
        dataSource={q.data?.items ?? []}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: q.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editing ? "编辑事件" : "新增事件"}
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

          editing ? updateM.mutate({ id: editing.id, payload }) : createM.mutate(payload);
        }}
        confirmLoading={createM.isPending || updateM.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="eventTime" label="事件时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="eventCharacter" label="事件类型" rules={[{ required: true }]}>
            <Select options={EVENT_TYPES} placeholder="请选择事件类型" />
          </Form.Item>

          <Form.Item name="staff" label="人员">
            <Input />
          </Form.Item>

          <Form.Item name="theme" label="主题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="content" label="内容">
            <TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
