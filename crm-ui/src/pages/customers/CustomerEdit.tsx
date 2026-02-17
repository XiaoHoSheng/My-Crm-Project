import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import { getCustomerById, updateCustomer } from "../../api/customers";
import { fetchCustomerTypes, type CustomerTypeItem } from "../../api/customerTypes";

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
};

type FormValues = {
  customerId?: number;
  grade?: string | null;
  name?: string | null;
  registrationTime?: Dayjs | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customerTypeId?: number | null;
};

export default function CustomerEdit() {
  const { id } = useParams();
  const numId = useMemo(() => Number(id), [id]);
  const isValidId = useMemo(() => Number.isFinite(numId) && numId > 0, [numId]);

  const nav = useNavigate();
  const [sp] = useSearchParams();
  const returnTo = sp.get("returnTo"); // "detail" | "list" | null

  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [typeOptions, setTypeOptions] = useState<{ value: number; label: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  const goBack = () => {
    if (returnTo === "detail" && isValidId) nav(`/customers/${numId}`);
    else nav("/customers");
  };

  const loadTypes = async () => {
    setTypesLoading(true);
    try {
      const list: CustomerTypeItem[] = await fetchCustomerTypes();
      setTypeOptions(list.map((x) => ({ value: x.typeId, label: x.name })));
    } catch (e) {
      console.error(e);
      message.error("加载客户类型失败（检查 /api/CustomerTypes）");
      setTypeOptions([]);
    } finally {
      setTypesLoading(false);
    }
  };

  const loadCustomer = async () => {
    if (!isValidId) return;
    setLoading(true);
    try {
      const c = await getCustomerById<CustomerDto>(numId);
      form.setFieldsValue({
        customerId: c.customerId,
        grade: c.grade ?? null,
        name: c.name ?? null,
        registrationTime: c.registrationTime ? dayjs(c.registrationTime) : null,
        contactPerson: c.contactPerson ?? null,
        phone: c.phone ?? null,
        email: c.email ?? null,
        address: c.address ?? null,
        customerTypeId: c.customerTypeId ?? null,
      });
    } catch (e: any) {
      console.error(e);
      message.error(e?.message ?? "加载客户失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
    loadCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onFinish = async (vals: FormValues) => {
    if (!isValidId) return;

    setSaving(true);
    try {
      const payload = {
        customerId: typeof vals.customerId === "number" ? vals.customerId : undefined,
        grade: vals.grade ?? null,
        name: vals.name?.trim() ?? null,
        registrationTime: vals.registrationTime ? vals.registrationTime.format("YYYY-MM-DDTHH:mm:ss") : null,
        contactPerson: vals.contactPerson?.trim() ?? null,
        phone: vals.phone?.trim() ?? null,
        email: vals.email?.trim() ?? null,
        address: vals.address?.trim() ?? null,
        customerTypeId: typeof vals.customerTypeId === "number" ? vals.customerTypeId : null,
      };

      await updateCustomer(numId, payload);
      message.success("保存成功");

      // ✅ 关键：保存后回到详情页（如果来自详情）
      goBack();
    } catch (e: any) {
      console.error(e);
      message.error(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <Card
        title="编辑客户"
        loading={loading}
        extra={
          <Button onClick={goBack} disabled={saving}>
            返回
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="客户名称" name="name" rules={[{ required: true, message: "请输入客户名称" }]}>
            <Input placeholder="例如 张三公司" />
          </Form.Item>

          <Form.Item label="客户类型" name="customerTypeId" rules={[{ required: true, message: "请选择客户类型" }]}>
            <Select allowClear placeholder="选择客户类型" loading={typesLoading} options={typeOptions} />
          </Form.Item>

          <Form.Item label="联系人" name="contactPerson">
            <Input />
          </Form.Item>

          <Form.Item label="电话" name="phone">
            <Input />
          </Form.Item>

          <Form.Item label="邮箱" name="email" rules={[{ type: "email", message: "邮箱格式不正确" }]}>
            <Input />
          </Form.Item>

          <Form.Item label="地址" name="address">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Card size="small" title="高级信息（可选）" style={{ marginBottom: 12 }}>
            <Form.Item label="客户编号" name="customerId">
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item label="等级" name="grade">
              <Select
                allowClear
                options={[
                  { value: "高", label: "高" },
                  { value: "中", label: "中" },
                  { value: "低", label: "低" },
                ]}
              />
            </Form.Item>

            <Form.Item label="注册日期" name="registrationTime">
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
            </Form.Item>
          </Card>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
            <Button onClick={goBack} disabled={saving}>
              取消
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
