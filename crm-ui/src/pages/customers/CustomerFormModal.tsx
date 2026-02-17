import { useEffect, useState } from "react";
import { Form, Input, Modal, Select, DatePicker, InputNumber, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import { fetchCustomerTypes, type CustomerTypeItem } from "../../api/customerTypes";

export type CustomerFormValues = {
  customerId?: number;
  grade?: string | null;
  name?: string | null;

  // ✅ 对外（传给父组件/后端）仍然是字符串（后端 DateTime 解析最稳）
  registrationTime?: string | null; // "YYYY-MM-DDTHH:mm:ss"

  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customerTypeId?: number | null;
};

// ✅ 表单内部用 Dayjs 承接 DatePicker
type FormInnerValues = Omit<CustomerFormValues, "registrationTime"> & {
  registrationTime?: Dayjs | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Partial<CustomerFormValues>;
  confirmLoading?: boolean;
  onCancel: () => void;

  // ✅ 父组件收到的是 string（YYYY-MM-DDTHH:mm:ss）或 null
  onOk: (values: CustomerFormValues) => void | Promise<void>;
};

function toDayjs(v?: string | null): Dayjs | null {
  if (!v) return null;
  // 兼容 "2026-01-19T00:00:00" / "2026-01-19"
  const s = v.includes("T") ? v : `${v}T00:00:00`;
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

export default function CustomerFormModal({
  open,
  mode,
  initialValues,
  confirmLoading,
  onCancel,
  onOk,
}: Props) {
  const [form] = Form.useForm<FormInnerValues>();

  // ✅ 客户类型动态 options
  const [typeOptions, setTypeOptions] = useState<{ value: number; label: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // 打开弹窗时加载客户类型
  useEffect(() => {
    if (!open) return;

    (async () => {
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
    })();
  }, [open]);

  // 打开弹窗时回填表单
  useEffect(() => {
    if (!open) return;

    form.resetFields();
    form.setFieldsValue({
      customerId: initialValues?.customerId,
      grade: initialValues?.grade ?? null,
      name: initialValues?.name ?? null,
      registrationTime: toDayjs(initialValues?.registrationTime),
      contactPerson: initialValues?.contactPerson ?? null,
      phone: initialValues?.phone ?? null,
      email: initialValues?.email ?? null,
      address: initialValues?.address ?? null,
      customerTypeId: initialValues?.customerTypeId ?? null,
    });
  }, [open, initialValues, form]);

  const handleFinish = async (vals: FormInnerValues) => {
    const payload: CustomerFormValues = {
      ...vals,

      // ✅ Dayjs -> "YYYY-MM-DDTHH:mm:ss"
      registrationTime: vals.registrationTime
        ? vals.registrationTime.format("YYYY-MM-DDTHH:mm:ss")
        : null,

      // ✅ 确保数字（避免 "10000" 这种字符串）
      customerId:
        typeof vals.customerId === "number" && Number.isFinite(vals.customerId)
          ? vals.customerId
          : undefined,

      customerTypeId:
        typeof vals.customerTypeId === "number" && Number.isFinite(vals.customerTypeId)
          ? vals.customerTypeId
          : null,
    };

    await onOk(payload);
  };

  return (
    <Modal
      open={open}
      title={mode === "create" ? "新增客户" : "编辑客户"}
      okText={mode === "create" ? "创建" : "保存"}
      cancelText="取消"
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="客户编号" name="customerId">
          <InputNumber style={{ width: "100%" }} placeholder="例如 20220001" />
        </Form.Item>

        <Form.Item label="等级" name="grade">
          <Select
            allowClear
            placeholder="选择等级"
            options={[
              { value: "高", label: "高" },
              { value: "中", label: "中" },
              { value: "低", label: "低" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="客户名称"
          name="name"
          rules={[{ required: true, message: "请输入客户名称" }]}
        >
          <Input placeholder="例如 张三公司" />
        </Form.Item>

        {/* ✅ 客户类型（动态加载 /api/CustomerTypes） */}
        <Form.Item
          label="客户类型"
          name="customerTypeId"
          rules={[{ required: true, message: "请选择客户类型" }]}
        >
          <Select
            allowClear
            placeholder="选择客户类型"
            options={typeOptions}
            loading={typesLoading}
          />
        </Form.Item>

        {/* ✅ 注册日期：DatePicker */}
        <Form.Item label="注册日期" name="registrationTime">
          <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" placeholder="选择日期" allowClear />
        </Form.Item>

        <Form.Item label="联系人" name="contactPerson">
          <Input placeholder="例如 李经理" />
        </Form.Item>

        <Form.Item label="电话" name="phone">
          <Input placeholder="例如 021xxxxxxx" />
        </Form.Item>

        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ type: "email", message: "邮箱格式不正确" }]}
        >
          <Input placeholder="例如 a@b.com" />
        </Form.Item>

        <Form.Item label="地址" name="address">
          <Input.TextArea rows={3} placeholder="例如 Hamilton..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}


