import { Button, Col, Form, Input, Row, Select, Space } from "antd";

export type CustomerFormValues = {
  customerId?: number;
  grade?: string | null;
  name?: string | null;
  registrationTime?: string | null; // 用 "YYYY-MM-DD" 字符串，避免 dayjs 依赖
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customerTypeId?: number | null;
  customerTypeName?: string | null; // 一般展示用，可不提交
};

type Props = {
  initialValues?: Partial<CustomerFormValues>;
  submitting?: boolean;
  submitText?: string;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function CustomerForm({
  initialValues,
  submitting,
  submitText = "保存",
  onSubmit,
  onCancel,
}: Props) {
  const [form] = Form.useForm<CustomerFormValues>();

  return (
    <Form<CustomerFormValues>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onSubmit}
    >
      <Row gutter={16}>
        <Col xs={24} md={12} lg={8}>
          <Form.Item label="客户编号" name="customerId">
            <Input inputMode="numeric" placeholder="例如 20220001" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
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
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item
            label="客户名称"
            name="name"
            rules={[{ required: true, message: "请输入客户名称" }]}
          >
            <Input placeholder="例如 张三公司" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item label="客户类型ID" name="customerTypeId">
            <Input inputMode="numeric" placeholder="例如 1/2/3" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item label="注册日期" name="registrationTime">
            <Input placeholder="YYYY-MM-DD，例如 2026-01-21" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item label="联系人" name="contactPerson">
            <Input placeholder="例如 李经理" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item label="电话" name="phone">
            <Input placeholder="例如 021xxxxxxx" />
          </Form.Item>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ type: "email", message: "邮箱格式不正确" }]}
          >
            <Input placeholder="例如 a@b.com" />
          </Form.Item>
        </Col>

        <Col xs={24} lg={16}>
          <Form.Item label="地址" name="address">
            <Input.TextArea rows={3} placeholder="例如 Hamilton..." />
          </Form.Item>
        </Col>
      </Row>

      <Space>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {submitText}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} disabled={submitting}>
            取消
          </Button>
        )}
      </Space>
    </Form>
  );
}
