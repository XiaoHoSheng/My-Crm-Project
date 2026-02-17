import { Modal, Form, Input, Switch, message, InputNumber } from "antd";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Contact, createContact, updateContact } from "@/api/contacts";

type Props = {
  open: boolean;
  editing: Contact | null;
  fixedCustomerId?: number;
  onClose: () => void;
  onOk: () => void;
};

export default function ContactFormModal({
  open,
  editing,
  fixedCustomerId,
  onClose,
  onOk,
}: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.resetFields();

    if (editing) {
      form.setFieldsValue(editing);
      if (fixedCustomerId != null) {
        form.setFieldsValue({ customerId: fixedCustomerId });
      }
    } else {
      form.setFieldsValue({
        isPrimary: false,
        customerId: fixedCustomerId ?? 0,
      });
    }
  }, [open, editing, fixedCustomerId, form]);

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (values.isPrimary) {
        message.info("该客户将只保留一个主联系人");
      }

      const payload = {
        customerId: fixedCustomerId ?? values.customerId ?? 0,
        name: values.name,
        title: values.title ?? "",
        phone: values.phone ?? "",
        email: values.email ?? "",
        wechat: values.wechat ?? "",
        isPrimary: !!values.isPrimary,
        tags: values.tags ?? "",
        notes: values.notes ?? "",
      };

      if (editing) return updateContact(editing.id, payload);
      return createContact(payload as any);
    },
    onSuccess: async () => {
      message.success(editing ? "已更新联系人" : "已创建联系人");
      onOk();
    },
    onError: () => message.error("保存失败"),
  });

  return (
    <Modal
      title={editing ? "编辑联系人" : "新增联系人"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={save.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
        {fixedCustomerId == null && (
          <Form.Item name="customerId" label="客户ID（可选）">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        )}

        <Form.Item
          name="name"
          label="姓名"
          rules={[{ required: true, message: "请输入姓名" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="title" label="职位">
          <Input />
        </Form.Item>

        <Form.Item
          name="phone"
          label="电话"
          rules={[
            { pattern: /^[0-9+\-\s]*$/, message: "电话格式不正确" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[{ type: "email", message: "邮箱格式不正确" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="wechat" label="微信">
          <Input />
        </Form.Item>

        <Form.Item name="tags" label="标签（逗号分隔）">
          <Input placeholder="例如：采购,决策人,财务" />
        </Form.Item>

        <Form.Item name="isPrimary" label="主联系人" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
