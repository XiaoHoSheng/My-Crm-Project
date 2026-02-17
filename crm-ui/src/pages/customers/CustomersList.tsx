import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Popconfirm,
  Popover,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import CustomerFormModal, { CustomerFormValues } from "./CustomerFormModal";
import CustomerQuickCreateDrawer, { type QuickCreateValues } from "./CustomerQuickCreateDrawer";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../../api/customers";

const { Text } = Typography;

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

function formatDate(d?: string | null) {
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0] : d;
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeText(v?: string | null) {
  return (v ?? "").trim();
}

// ====== localStorage keys ======
const LS_COLS_KEY = "crm.customers.columns.v1";
const LS_DENSITY_KEY = "crm.customers.density.v1";

// ====== column keys（用于列设置）======
const COL_KEYS = {
  id: "id",
  customerId: "customerId",
  grade: "grade",
  name: "name",
  customerTypeName: "customerTypeName",
  registrationTime: "registrationTime",
  contactPerson: "contactPerson",
  phone: "phone",
  email: "email",
  address: "address",
  actions: "actions",
} as const;

type Density = "small" | "middle" | "large";

export default function CustomersList() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  // ===== URL state =====
  const [page, setPage] = useState(() => toInt(sp.get("page"), 1));
  const [pageSize, setPageSize] = useState(() => toInt(sp.get("pageSize"), 10));
  const [keyword, setKeyword] = useState(() => safeText(sp.get("keyword")));
  const [kwInput, setKwInput] = useState(() => safeText(sp.get("keyword")));

  // ===== data =====
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CustomerDto[]>([]);
  const [total, setTotal] = useState(0);

  // ===== edit modal =====
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ===== quick create drawer =====
  const [quickOpen, setQuickOpen] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);

  // ===== 列设置 & 密度（持久化）=====
  const defaultVisibleCols = useMemo(() => {
    // 默认：除 actions 之外都显示，actions 永远显示
    return [
      COL_KEYS.id,
      COL_KEYS.customerId,
      COL_KEYS.grade,
      COL_KEYS.name,
      COL_KEYS.customerTypeName,
      COL_KEYS.registrationTime,
      COL_KEYS.contactPerson,
      COL_KEYS.phone,
      COL_KEYS.email,
      COL_KEYS.address,
      COL_KEYS.actions,
    ];
  }, []);

  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_COLS_KEY);
      if (!raw) return defaultVisibleCols;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return defaultVisibleCols;
      // actions 强制保留
      const set = new Set<string>(parsed);
      set.add(COL_KEYS.actions);
      return Array.from(set);
    } catch {
      return defaultVisibleCols;
    }
  });

  const [density, setDensity] = useState<Density>(() => {
    const raw = localStorage.getItem(LS_DENSITY_KEY);
    if (raw === "small" || raw === "middle" || raw === "large") return raw;
    return "middle";
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLS_KEY, JSON.stringify(visibleCols));
    } catch {
      // ignore
    }
  }, [visibleCols]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DENSITY_KEY, density);
    } catch {
      // ignore
    }
  }, [density]);

  // ===== URL sync helper =====
  const syncUrl = (
    next: Partial<{ page: number; pageSize: number; keyword: string }>,
    replace = true
  ) => {
    const p = String(next.page ?? page);
    const ps = String(next.pageSize ?? pageSize);
    const kw = safeText(next.keyword ?? keyword);

    const params: Record<string, string> = { page: p, pageSize: ps };
    if (kw) params.keyword = kw;
    setSp(params, { replace });
  };

  // URL -> state（支持浏览器前进后退）
  useEffect(() => {
    const p = toInt(sp.get("page"), 1);
    const ps = toInt(sp.get("pageSize"), 10);
    const kw = safeText(sp.get("keyword"));

    setPage((old) => (old !== p ? p : old));
    setPageSize((old) => (old !== ps ? ps : old));
    setKeyword((old) => (old !== kw ? kw : old));
    setKwInput((old) => (old !== kw ? kw : old));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  async function load(opts?: { page?: number; pageSize?: number; keyword?: string }) {
    setLoading(true);
    try {
      const res = await fetchCustomers({
        page: opts?.page ?? page,
        pageSize: opts?.pageSize ?? pageSize,
        keyword: safeText(opts?.keyword ?? keyword) || undefined,
      });
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      console.error(e);
      message.error(e?.message ?? "加载失败");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, keyword]);

  // ===== actions =====
  const openEdit = (r: CustomerDto) => {
    setEditing(r);
    setEditOpen(true);
  };

  const doSearch = () => {
    const kw = safeText(kwInput);
    setPage(1);
    setKeyword(kw);
    syncUrl({ page: 1, keyword: kw }, false);
  };

  const doReset = () => {
    setKwInput("");
    setKeyword("");
    setPage(1);
    syncUrl({ page: 1, keyword: "" }, false);
  };

  // ===== columns definition（全量）=====
  const allColumns: ColumnsType<CustomerDto> = useMemo(
    () => [
      {
        key: COL_KEYS.id,
        title: "ID",
        dataIndex: "id",
        width: 80,
        fixed: "left",
      },
      {
        key: COL_KEYS.customerId,
        title: "客户编号",
        dataIndex: "customerId",
        width: 120,
      },
      {
        key: COL_KEYS.grade,
        title: "等级",
        dataIndex: "grade",
        width: 110,
        render: (v: string | null | undefined) => (v ? <Tag>{v}</Tag> : "-"),
      },
      {
        key: COL_KEYS.name,
        title: "客户名称",
        dataIndex: "name",
        width: 200,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 180 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.customerTypeName,
        title: "客户类型",
        dataIndex: "customerTypeName",
        width: 160,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 140 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.registrationTime,
        title: "注册日期",
        dataIndex: "registrationTime",
        width: 130,
        render: (v: string | null | undefined) => (
          <span style={{ whiteSpace: "nowrap" }}>{formatDate(v)}</span>
        ),
      },
      {
        key: COL_KEYS.contactPerson,
        title: "联系人",
        dataIndex: "contactPerson",
        width: 160,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 140 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.phone,
        title: "电话",
        dataIndex: "phone",
        width: 160,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 140 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.email,
        title: "邮箱",
        dataIndex: "email",
        width: 220,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 200 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.address,
        title: "地址",
        dataIndex: "address",
        width: 260,
        ellipsis: true,
        render: (v?: string | null) => (
          <Text ellipsis={{ tooltip: v ?? "-" }} style={{ maxWidth: 240 }}>
            {v ?? "-"}
          </Text>
        ),
      },
      {
        key: COL_KEYS.actions,
        title: "操作",
        width: 220,
        fixed: "right",
        render: (_, r) => (
          <Space size={12}>
            <Link to={`/customers/${r.id}`}>详情</Link>
            <a onClick={() => openEdit(r)}>编辑</a>
            <Popconfirm
              title="确定删除这个客户吗？"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={async () => {
                try {
                  await deleteCustomer(r.id);
                  message.success("删除成功");

                  // 删除后避免空页
                  const newTotal = Math.max(0, total - 1);
                  const lastPage = Math.max(1, Math.ceil(newTotal / pageSize));
                  const nextPage = Math.min(page, lastPage);

                  if (nextPage !== page) {
                    setPage(nextPage);
                    syncUrl({ page: nextPage }, false);
                    await load({ page: nextPage });
                  } else {
                    await load();
                  }
                } catch (e: any) {
                  console.error(e);
                  message.error(e?.message ?? "删除失败");
                }
              }}
            >
              <a style={{ color: "#ff4d4f" }}>删除</a>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, total, rows.length]
  );

  // ===== 根据列设置过滤（actions 永远显示）=====
  const displayColumns = useMemo(() => {
    const visibleSet = new Set(visibleCols);
    visibleSet.add(COL_KEYS.actions);

    // fixed 列如果被隐藏，可能需要调整 scroll.x；这里不强制处理，Table 的 scroll.x 已经兜底
    return allColumns.filter((c) => {
      const k = String(c.key ?? "");
      return visibleSet.has(k);
    });
  }, [allColumns, visibleCols]);

  // ===== 列设置 UI =====
  const columnOptions = useMemo(
    () => [
      { label: "ID", value: COL_KEYS.id },
      { label: "客户编号", value: COL_KEYS.customerId },
      { label: "等级", value: COL_KEYS.grade },
      { label: "客户名称", value: COL_KEYS.name },
      { label: "客户类型", value: COL_KEYS.customerTypeName },
      { label: "注册日期", value: COL_KEYS.registrationTime },
      { label: "联系人", value: COL_KEYS.contactPerson },
      { label: "电话", value: COL_KEYS.phone },
      { label: "邮箱", value: COL_KEYS.email },
      { label: "地址", value: COL_KEYS.address },
      // actions 不给用户隐藏（强制保留）
    ],
    []
  );

  const handleColsChange = (vals: any) => {
    const arr = Array.isArray(vals) ? vals.map(String) : [];
    const set = new Set(arr);
    set.add(COL_KEYS.actions);
    setVisibleCols(Array.from(set));
  };

  const densityOptions = [
    { label: "紧凑", value: "small" },
    { label: "默认", value: "middle" },
    { label: "宽松", value: "large" },
  ] as const;

  return (
    <div className="app-container">
      {/* 标题 + 右侧按钮区 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 0 }}>
          客户列表
        </Typography.Title>

        <Space>
          {/* 主入口：页面新增 */}
          <Button type="primary" onClick={() => nav("/customers/new")}>
            新增客户
          </Button>

          {/* 快速新增：Drawer */}
          <Button onClick={() => setQuickOpen(true)}>快速新增</Button>

          <Button onClick={() => load()}>刷新</Button>
        </Space>
      </div>

      {/* 搜索 */}
      <Space style={{ width: "100%", margin: "16px 0" }} wrap>
        <Input
          placeholder="搜索：姓名 / 联系人 / 电话"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          style={{ width: 380, maxWidth: "100%" }}
          onPressEnter={doSearch}
          allowClear
        />

        <Button type="primary" onClick={doSearch}>
          搜索
        </Button>

        <Button onClick={doReset}>重置</Button>

        {/* 右侧表格设置区：列设置 + 密度 */}
        <Popover
          trigger="click"
          placement="bottomLeft"
          content={
            <div style={{ width: 260 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>列设置</div>
              <Checkbox.Group
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
                options={columnOptions}
                value={visibleCols.filter((k) => k !== COL_KEYS.actions)}
                onChange={handleColsChange}
              />

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
                <Button
                  size="small"
                  onClick={() => setVisibleCols(defaultVisibleCols)}
                >
                  恢复默认
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    // 全选（同样强制保留 actions）
                    const all = columnOptions.map((x) => x.value);
                    setVisibleCols([...all, COL_KEYS.actions]);
                  }}
                >
                  全部显示
                </Button>
              </div>
            </div>
          }
        >
          <Button>列设置</Button>
        </Popover>

        <Segmented
          value={density}
          onChange={(v) => setDensity(v as Density)}
          options={densityOptions as any}
        />
      </Space>

      <Table<CustomerDto>
        className="crm-table"
        rowKey="id"
        loading={loading}
        columns={displayColumns}
        dataSource={rows}
        size={density}
        tableLayout="fixed"
        sticky
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            syncUrl({ page: p, pageSize: ps }, false);
          },
        }}
      />

      {/* 编辑：Modal（保留） */}
      <CustomerFormModal
        open={editOpen}
        mode="edit"
        confirmLoading={savingEdit}
        initialValues={
          editing
            ? {
                customerId: editing.customerId,
                grade: editing.grade ?? null,
                name: editing.name ?? null,
                registrationTime: editing.registrationTime ?? null,
                contactPerson: editing.contactPerson ?? null,
                phone: editing.phone ?? null,
                email: editing.email ?? null,
                address: editing.address ?? null,
                customerTypeId: editing.customerTypeId ?? null,
              }
            : undefined
        }
        onCancel={() => setEditOpen(false)}
        onOk={async (values) => {
          if (!editing) return;
          setSavingEdit(true);
          try {
            await updateCustomer(editing.id, values);
            message.success("保存成功");
            setEditOpen(false);
            await load();
          } catch (e: any) {
            console.error(e);
            message.error(e?.message ?? "保存失败");
          } finally {
            setSavingEdit(false);
          }
        }}
      />

      {/* 快速新增：Drawer（最小字段集） */}
      <CustomerQuickCreateDrawer
        open={quickOpen}
        confirmLoading={savingQuick}
        onClose={() => setQuickOpen(false)}
        onOk={async (vals: QuickCreateValues) => {
          setSavingQuick(true);
          try {
            // 后端一般允许缺省字段；如果你后端必填更多字段，再告诉我我帮你补默认值
            await createCustomer(vals as any);
            message.success("创建成功");
            setQuickOpen(false);

            setPage(1);
            syncUrl({ page: 1 }, false);
            await load({ page: 1 });
          } catch (e: any) {
            console.error(e);
            message.error(e?.message ?? "创建失败");
          } finally {
            setSavingQuick(false);
          }
        }}
      />
    </div>
  );
}
