import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Statistic, Table, Spin, Tag } from "antd";
import { 
  UserOutlined, 
  ShoppingOutlined, 
  DollarOutlined, 
  TrophyOutlined 
} from "@ant-design/icons";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { fetchDashboardStats, fetchFunnelData, fetchRecentWonDeals } from "../../api/dashboard";

// 阶段颜色
const COLORS: Record<string, string> = {
  New: "#1677ff",
  Discovery: "#13c2c2",
  Proposal: "#fa8c16",
  Negotiation: "#722ed1",
  Won: "#52c41a",
  Lost: "#ff4d4f",
};

export default function DashboardPage() {
  // 1. 获取 KPI 数据
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  // 2. 获取图表数据
  const { data: funnelData = [] } = useQuery({
    queryKey: ["dashboard", "funnel"],
    queryFn: fetchFunnelData,
  });

  // 3. 获取最近成交
  const { data: recentDeals = [] } = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: fetchRecentWonDeals,
  });

  if (statsLoading) return <Spin size="large" className="block m-10" />;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>

      {/* --- 第一部分：KPI 卡片 --- */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Total Customers"
              value={stats?.totalCustomers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Active Deals"
              value={stats?.activeOpportunities}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Forecast Revenue"
              value={stats?.totalForecastAmount}
              precision={2}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Won This Month"
              value={stats?.wonDealsThisMonth}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* --- 第二部分：图表区域 --- */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* 左侧：销售漏斗 (用横向柱状图模拟) */}
        <Col xs={24} lg={12}>
          <Card title="Sales Pipeline (By Count)" bordered={false} style={{ height: 400 }}>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={funnelData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={80} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="count" barSize={20} radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.stage] || "#8884d8"} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </Card>
        </Col>

        {/* 右侧：阶段金额分布 */}
        <Col xs={24} lg={12}>
          <Card title="Revenue Forecast (By Stage)" bordered={false} style={{ height: 400 }}>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
                  <Bar dataKey="totalAmount" fill="#8884d8" barSize={40}>
                     {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.stage] || "#8884d8"} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* --- 第三部分：最近成交列表 --- */}
      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Recently Won Deals" bordered={false}>
            <Table 
              dataSource={recentDeals} 
              rowKey="id" 
              pagination={false}
              size="small"
              columns={[
                { title: 'Deal Name', dataIndex: 'name', key: 'name', render: (text) => <b>{text}</b> },
                { title: 'Customer', dataIndex: 'customerName', key: 'customerName' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val) => <span style={{color:'green'}}>${val.toLocaleString()}</span> },
                { title: 'Close Date', dataIndex: 'closeDate', key: 'closeDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
                { title: 'Status', key: 'status', render: () => <Tag color="green">WON</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
