import { useEffect, useMemo, useState } from "react";
import { Button, Input, Popconfirm, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import ContactFormModal from "../contacts/ContactFormModal";
import {
  Contact,
  PagedResult,
  deleteContact,
  fetchContacts,
} from "@/api/contacts";

const PAGE_SIZE = 10;

export default function ContactsTab({ customerId }: { customerId: number }) {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  // 切换客户时，重置搜索/页码
  useEffect(() => {
    setKeyword("");
    setPage(1);
    setOpen(false);
    setEditing(null);
  }, [customerId]);

  const queryKey = useMemo(
    () => ["customerContacts", customerId, page, PAGE_SIZE, keyword],
    [customerId, page, keyword]
  );

  const { data, isLoading } = useQuery<PagedResult<Contact>>({
    queryKey,
    queryFn: () =>
      fetchContacts({
        customerId,
        keyword: keyword || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const invalidateCustomerContacts = async () => {
    await qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === "customerContacts" &&
        q.queryKey[1] === customerId,
    });
  };

  const del = useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: async () => {
      message.success("已删除");
      await invalidateCustomerContacts();
    },
    onError: () => message.error("删除失败"),
  });

  const columns: ColumnsType<Contact> = [
    { title: "姓名", dataIndex: "name", width: 160 },
    { title: "职位", dataIndex: "title", width: 140 },
    { title: "电话", dataIndex: "phone", width: 160 },
    { title: "邮箱", dataIndex: "email", width: 220 },
    { title: "微信", dataIndex: "wechat", width: 140 },
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
    <div style={{ padding: 8 }}>
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

        <Button onClick={invalidateCustomerContacts}>刷新</Button>
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
        fixedCustomerId={customerId}   // ✅ 关键：固定绑定当前客户
        onClose={() => setOpen(false)}
        onOk={async () => {
          setOpen(false);
          await invalidateCustomerContacts();
        }}
      />
    </div>
  );
}
