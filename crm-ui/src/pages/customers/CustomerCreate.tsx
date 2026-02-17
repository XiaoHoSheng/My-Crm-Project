import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";

import { createCustomer } from "../../api/customers";
import { fetchCustomerTypes, type CustomerTypeItem } from "../../api/customerTypes";
import type { CustomerFormValues } from "./CustomerFormModal";

type FormInnerValues = Omit<CustomerFormValues, "registrationTime"> & {
  registrationTime?: Dayjs | null;
};

export default function CustomerCreate() {
  const nav = useNavigate();
  const [form] = Form.useForm<FormInnerValues>();

  const [saving, setSaving] = useState(false);
  const [typeOptions, setTypeOptions] = useState<{ value: number; label: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleFinish = async (vals: FormInnerValues) => {
    const payload: CustomerFormValues = {
      ...vals,
      name: vals.name?.trim() ?? null,
      contactPerson: vals.contactPerson?.trim() ?? null,
      phone: vals.phone?.trim() ?? null,
      email: vals.email?.trim() ?? null,
      address: vals.address?.trim() ?? null,

      // Dayjs -> string
      registrationTime: vals.registrationTime
        ? vals.registrationTime.format("YYYY-MM-DDTHH:mm:ss")
        : null,

      customerId:
        typeof vals.customerId === "number" && Number.isFinite(vals.customerId)
          ? vals.customerId
          : undefined,

      customerTypeId:
        typeof vals.customerTypeId === "number" && Number.isFinite(vals.customerTypeId)
          ? vals.customerTypeId
          : null,
    };

    setSaving(true);
    try {
      await createCustomer(payload);
      message.success("新增成功");
      nav("/customers");
    } catch (e: any) {
      console.error(e);
      message.error(e?.message ?? "新增失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <Card
        title="新增客户"
        extra={
          <Button onClick={() => nav("/customers")} disabled={saving}>
            返回列表
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* ✅ 基础信息（常用） */}
          <Card size="small" title="基础信息" style={{ marginBottom: 12 }}>
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
          </Card>

          {/* ✅ 高级信息（不常用，折叠） */}
          <Collapse
            defaultActiveKey={[]}
            items={[
              {
                key: "advanced",
                label: "高级信息（可选）",
                children: (
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
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

                    <Form.Item label="注册日期" name="registrationTime">
                      <DatePicker
                        style={{ width: "100%" }}
                        format="YYYY-MM-DD"
                        placeholder="选择日期"
                        allowClear
                      />
                    </Form.Item>

                    <Form.Item label="地址" name="address">
                      <Input.TextArea rows={3} placeholder="例如 Hamilton..." />
                    </Form.Item>
                  </Space>
                ),
              },
            ]}
          />

          <div style={{ marginTop: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                创建
              </Button>
              <Button onClick={() => nav("/customers")} disabled={saving}>
                取消
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
}
