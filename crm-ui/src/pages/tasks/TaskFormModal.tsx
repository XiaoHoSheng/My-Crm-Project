import { Modal, Form, Input, Select, DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { type TaskStatus, type TaskDto } from "@/api/tasks";

type FormValues = {
  title: string;
  status: TaskStatus;
  assignedTo?: string | null;
  dueDate?: Dayjs | null;
};

export default function TaskFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial?: TaskDto | null;
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    status: TaskStatus;
    assignedTo?: string | null;
    dueDate?: string | null;
  }) => Promise<void> | void;
  confirmLoading?: boolean;
}) {
  const { open, mode, initial, onCancel, onSubmit, confirmLoading } = props;
  const [form] = Form.useForm<FormValues>();

  // 每次打开时回填
  const initValues: FormValues = {
    title: initial?.title ?? "",
    status: (initial?.status ?? "Pending") as TaskStatus,
    assignedTo: initial?.assignedTo ?? "Jason",
    dueDate: initial?.dueDate ? dayjs(initial.dueDate) : null,
  };

  return (
    <Modal
      title={mode === "create" ? "新增任务" : "编辑任务"}
      open={open}
      onCancel={onCancel}
      okText={mode === "create" ? "创建" : "保存"}
      confirmLoading={confirmLoading}
      destroyOnClose
      onOk={async () => {
        const v = await form.validateFields();
        await onSubmit({
          title: v.title,
          status: v.status,
          assignedTo: v.assignedTo ?? null,
          dueDate: v.dueDate ? v.dueDate.toISOString() : null,
        });
      }}
      afterOpenChange={(isOpen) => {
        if (isOpen) form.setFieldsValue(initValues);
      }}
    >
      <Form form={form} layout="vertical" initialValues={initValues}>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: "请输入任务标题" }]}
        >
          <Input placeholder="例如：回访张三客户" />
        </Form.Item>

        <Form.Item
          label="状态"
          name="status"
          rules={[{ required: true, message: "请选择状态" }]}
        >
          <Select
            options={[
              { value: "Pending", label: "Pending" },
              { value: "Doing", label: "Doing" },
              { value: "Done", label: "Done" },
            ]}
          />
        </Form.Item>

        <Form.Item label="负责人" name="assignedTo">
          <Input placeholder="例如：Jason" />
        </Form.Item>

        <Form.Item label="截止日期" name="dueDate">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}


