import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, Select, DatePicker, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createOpportunity, updateOpportunity, STAGES, Opportunity } from "../../api/opportunities";
import { fetchCustomers } from "../../api/customers"; 

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues: Opportunity | null;
}

export default function OpportunityFormModal({ open, onClose, onSuccess, initialValues }: Props) {
  const [form] = Form.useForm();
  const isEdit = !!initialValues;

  // 1. 获取客户列表（用于下拉选择客户）
  const { data: customerData } = useQuery({
    queryKey: ["customers_all"], 
    queryFn: () => fetchCustomers({ page: 1, pageSize: 100 }), // 简单起见取前100个
    enabled: open, // 只有弹窗打开时才去查
  });
  const customers = customerData?.items || [];

  // 2. 初始化表单数据
  useEffect(() => {
    if (open) {
      if (initialValues) {
        // 编辑模式：回填数据
        form.setFieldsValue({
          ...initialValues,
          closingDate: initialValues.closingDate ? dayjs(initialValues.closingDate) : null,
        });
      } else {
        // 新增模式：重置并设置默认值
        form.resetFields();
        form.setFieldsValue({ stage: "New" });
      }
    }
  }, [open, initialValues, form]);

  // 3. 提交逻辑
  const mutation = useMutation({
    mutationFn: (values: any) => {
      const payload = {
        ...values,
        // 格式化日期发给后端
        closingDate: values.closingDate ? values.closingDate.format("YYYY-MM-DD") : null,
      };
      return isEdit ? updateOpportunity(initialValues!.id, payload) : createOpportunity(payload);
    },
    onSuccess: () => {
      message.success(isEdit ? "Saved!" : "Created!");
      onSuccess();
    },
  });

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit Deal" : "New Deal"}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(vals) => mutation.mutate(vals)}>
        <Form.Item name="name" label="Deal Name" rules={[{ required: true, message: 'Please enter name' }]}>
          <Input placeholder="e.g. 500 Licenses Deal" />
        </Form.Item>

        <Form.Item name="amount" label="Amount ($)" rules={[{ required: true, message: 'Please enter amount' }]}>
          <InputNumber style={{ width: "100%" }} prefix="$" min={0} />
        </Form.Item>

        <Form.Item name="customerId" label="Customer" rules={[{ required: true, message: 'Please select a customer' }]}>
          <Select
            showSearch
            placeholder="Select a customer"
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
            }
          >
            {customers.map((c: any) => (
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div style={{ display: "flex", gap: 16 }}>
          <Form.Item name="stage" label="Stage" style={{ flex: 1 }}>
            <Select options={STAGES.map(s => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item name="closingDate" label="Expected Close Date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </div>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}