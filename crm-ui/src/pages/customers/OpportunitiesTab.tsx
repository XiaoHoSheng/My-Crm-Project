import { useQuery } from "@tanstack/react-query";
import { Table, Tag, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { fetchOpportunitiesByCustomerId, Opportunity } from "../../api/opportunities";

const STAGE_COLORS: Record<string, string> = {
  New: "blue",
  Discovery: "cyan",
  Proposal: "orange",
  Negotiation: "purple",
  Won: "green",
  Lost: "red",
};

interface Props {
  customerId: number;
}

export default function OpportunitiesTab({ customerId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["opportunities", "by-customer", customerId],
    queryFn: () => fetchOpportunitiesByCustomerId(customerId),
  });

  const columns: ColumnsType<Opportunity> = [
    {
      title: "Deal Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (val) => val ? `$${val.toLocaleString()}` : "-",
    },
    {
      title: "Stage",
      dataIndex: "stage",
      key: "stage",
      render: (stage) => (
        <Tag color={STAGE_COLORS[stage] || "default"}>{stage}</Tag>
      ),
    },
    {
      title: "Expected Close",
      dataIndex: "closingDate",
      key: "closingDate",
      render: (date) => date ? dayjs(date).format("YYYY-MM-DD") : "-",
    },
  ];

  if (!data || data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No deals found." />;
  }

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={isLoading}
      pagination={false}
      size="small"
    />
  );
}