import { useMemo, useState } from "react";
import { Button, Input, Space, Table, Tag, Popconfirm, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { Contact, PagedResult, deleteContact, fetchContacts } from "@/api/contacts";
import ContactFormModal from "./ContactFormModal";

const PAGE_SIZE = 10;

export default function ContactsList() {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const queryKey = useMemo(
    () => ["contacts", { keyword, page, pageSize: PAGE_SIZE }],
    [keyword, page]
  );

  const { data, isLoading } = useQuery<PagedResult<Contact>>({
    queryKey,
    queryFn: () => fetchContacts({ keyword, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData, // ✅ React Query v5 写法（代替 keepPreviousData: true）
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: async () => {
      message.success("已删除");
      await qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: () => message.error("删除失败"),
  });

  const columns: ColumnsType<Contact> = [
    { title: "姓名", dataIndex: "name", width: 160 },
    { title: "电话", dataIndex: "phone", width: 160 },
    { title: "邮箱", dataIndex: "email", width: 220 },
    {
      title: "主联系人",
      dataIndex: "isPrimary",
      width: 110,
      render: (v: boolean) => (v ? <Tag>Primary</Tag> : null),
    },
    {
      title: "标签",
      dataIndex: "tags",
      render: (v: string | null | undefined) =>
        v ? v.split(",").map((t) => <Tag key={t}>{t.trim()}</Tag>) : null,
    },
    {
      title: "操作",
      width: 180,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(row);
              setOpen(true);
            }}
          >
            编辑
          </Button>

          <Popconfirm title="确认删除？" onConfirm={() => del.mutate(row.id)}>
            <Button size="small" danger loading={del.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Input
          placeholder="搜索姓名/电话/邮箱"
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          style={{ width: 260 }}
        />
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          新增联系人
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
      />

      <ContactFormModal
        open={open}
        editing={editing}
        onClose={() => setOpen(false)}
        onOk={async () => {
          setOpen(false);
          await qc.invalidateQueries({ queryKey: ["contacts"] });
        }}
      />
    </div>
  );
}
