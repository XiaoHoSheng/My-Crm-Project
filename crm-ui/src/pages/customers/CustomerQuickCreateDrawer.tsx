import { useEffect, useState } from "react";
import { Button, Drawer, Form, Input, Select, Space, message } from "antd";

import { fetchCustomerTypes, type CustomerTypeItem } from "../../api/customerTypes";

export type QuickCreateValues = {
  name?: string | null;
  customerTypeId?: number | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Props = {
  open: boolean;
  confirmLoading?: boolean;
  onClose: () => void;
  onOk: (values: QuickCreateValues) => void | Promise<void>;
};

export default function CustomerQuickCreateDrawer({
  open,
  confirmLoading,
  onClose,
  onOk,
}: Props) {
  const [form] = Form.useForm<QuickCreateValues>();

  const [typeOptions, setTypeOptions] = useState<{ value: number; label: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    form.resetFields();

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
  }, [open, form]);

  const handleFinish = async (vals: QuickCreateValues) => {
    const payload: QuickCreateValues = {
      name: vals.name?.trim() ?? null,
      customerTypeId:
        typeof vals.customerTypeId === "number" && Number.isFinite(vals.customerTypeId)
          ? vals.customerTypeId
          : null,
      contactPerson: vals.contactPerson?.trim() ?? null,
      phone: vals.phone?.trim() ?? null,
      email: vals.email?.trim() ?? null,
    };

    await onOk(payload);
  };

  return (
    <Drawer
      open={open}
      title="快速新增客户"
      width={480}
      onClose={onClose}
      destroyOnClose
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Space>
            <Button onClick={onClose} disabled={confirmLoading}>
              取消
            </Button>
            <Button type="primary" loading={confirmLoading} onClick={() => form.submit()}>
              创建
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="客户名称"
          name="name"
          rules={[{ required: true, message: "请输入客户名称" }]}
        >
          <Input placeholder="例如 张三公司" />
        </Form.Item>

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
      </Form>
    </Drawer>
  );
}
