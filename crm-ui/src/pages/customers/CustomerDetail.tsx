import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Card, Descriptions, Spin, Tabs, Modal, message } from "antd";
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, RiseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { getCustomerById, deleteCustomer } from "../../api/customers";
import ContactsTab from "./ContactsTab";
import TasksTab from "./TasksTab";
import ActivitiesTimelineTab from "./ActivitiesTimelineTab";
import OpportunitiesTab from "./OpportunitiesTab"; // ✅ 引入新组件

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 获取详情
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomerById(id!),
    enabled: !!id,
  });

  // 删除 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      message.success("Customer deleted");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate("/customers");
    },
    onError: () => message.error("Failed to delete customer"),
  });

  const handleDelete = () => {
    Modal.confirm({
      title: "Are you sure?",
      content: "This will delete the customer and related data.",
      okText: "Delete",
      okType: "danger",
      onOk: () => {
        if (id) deleteMutation.mutate(id);
      },
    });
  };

  if (isLoading) return <Spin className="block m-10" />;
  if (error || !customer) return <div>Error loading customer.</div>;

  // 定义标签页内容
  const tabItems = [
    {
      key: "details",
      label: "Details",
      children: (
        <Descriptions bordered column={1} labelStyle={{ width: 140 }}>
          <Descriptions.Item label="Customer ID">{customer.CustomerId}</Descriptions.Item>
          <Descriptions.Item label="Grade">{customer.Grade}</Descriptions.Item>
          <Descriptions.Item label="Registration">
            {customer.RegistrationTime ? dayjs(customer.RegistrationTime).format("YYYY-MM-DD") : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Contact Person">{customer.ContactPerson}</Descriptions.Item>
          <Descriptions.Item label="Phone">{customer.Phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.Email}</Descriptions.Item>
          <Descriptions.Item label="Address">{customer.Address}</Descriptions.Item>
          <Descriptions.Item label="Type">{customer.CustomerTypeName || "-"}</Descriptions.Item>
        </Descriptions>
      ),
    },
    // ✅ 新增：商机 Tab
    {
      key: "opportunities",
      label: (
        <span>
          <RiseOutlined /> Opportunities
        </span>
      ),
      children: <OpportunitiesTab customerId={customer.Id} />,
    },
    {
      key: "contacts",
      label: "Contacts",
      children: <ContactsTab customerId={customer.Id} />,
    },
    {
      key: "tasks",
      label: "Tasks",
      children: <TasksTab customerId={customer.Id} />,
    },
    {
      key: "activities",
      label: "Timeline",
      children: <ActivitiesTimelineTab customerId={customer.Id} />,
    },
  ];

  return (
    <div className="p-4">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/customers")} className="mb-4">
        Back
      </Button>

      <Card
        title={customer.Name}
        extra={
          <div className="space-x-2">
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/customers/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        }
      >
        <Tabs defaultActiveKey="details" items={tabItems} />
      </Card>
    </div>
  );
}