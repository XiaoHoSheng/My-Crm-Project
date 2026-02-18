import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Spin, Select, Modal, message, Tag } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, DollarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { fetchOpportunities, updateOpportunityStage, deleteOpportunity, STAGES, Opportunity } from "../../api/opportunities";
import OpportunityFormModal from "./OpportunityFormModal";

// 不同阶段的颜色条（装饰用）
const STAGE_COLORS: Record<string, string> = {
  New: "#1677ff",       // 蓝
  Discovery: "#13c2c2", // 青
  Proposal: "#fa8c16",  // 橙
  Negotiation: "#722ed1", // 紫
  Won: "#52c41a",       // 绿
  Lost: "#ff4d4f",      // 红
};

export default function OpportunitiesBoard() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Opportunity | null>(null);

  // 1. 获取商机数据
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
  });

  // 2. 修改阶段 Mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) => updateOpportunityStage(id, stage),
    onSuccess: () => {
      message.success("Stage updated!");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  // 3. 删除 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteOpportunity,
    onSuccess: () => {
      message.success("Deleted!");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const handleCreate = () => {
    setEditingOp(null);
    setIsModalOpen(true);
  };

  const handleEdit = (op: Opportunity) => {
    setEditingOp(op);
    setIsModalOpen(true);
  };

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;

  return (
    <div style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 顶部标题栏 */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Sales Pipeline</h1>
          <span style={{ color: "#888" }}>Manage your deals and track progress</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleCreate}>
          New Deal
        </Button>
      </div>

      {/* 看板区域 (横向滚动) */}
      <div style={{ flex: 1, overflowX: "auto", paddingBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, minWidth: 1600, height: "100%" }}>
          
          {STAGES.map((stage) => {
            // 筛选属于当前列的卡片
            const ops = opportunities.filter((o) => o.stage === stage);
            const totalAmount = ops.reduce((sum, o) => sum + (o.amount || 0), 0);

            return (
              <div
                key={stage}
                style={{
                  flex: 1,
                  background: "#f7f7f7",
                  padding: "12px 12px 0 12px", // 底部留白给滚动
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  borderTop: `4px solid ${STAGE_COLORS[stage] || "#ccc"}`,
                }}
              >
                {/* 列头统计 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 16 }}>{stage}</strong>
                    <Tag>{ops.length}</Tag>
                  </div>
                  <div style={{ color: "#555", fontWeight: 500 }}>
                     ${totalAmount.toLocaleString()}
                  </div>
                </div>

                {/* 卡片列表容器 (纵向滚动) */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  {ops.map((op) => (
                    <Card
                      key={op.id}
                      hoverable
                      size="small"
                      style={{ borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
                      actions={[
                        <EditOutlined key="edit" onClick={() => handleEdit(op)} />,
                        <DeleteOutlined key="del" onClick={() => Modal.confirm({
                          title: "Delete this deal?",
                          content: "This action cannot be undone.",
                          onOk: () => deleteMutation.mutate(op.id)
                        })} />,
                      ]}
                    >
                      {/* 客户名 */}
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                        🏢 {op.customerName || "Unknown Customer"}
                      </div>
                      
                      {/* 商机名 */}
                      <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 8, lineHeight: 1.4 }}>
                        {op.name}
                      </div>

                      {/* 金额 */}
                      <div style={{ color: "#1677ff", fontWeight: 600, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <DollarOutlined /> {op.amount?.toLocaleString()}
                      </div>

                      {/* 预计日期 */}
                      {op.closingDate && (
                        <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
                          📅 Close: {dayjs(op.closingDate).format("MMM D, YYYY")}
                        </div>
                      )}

                      {/* 移动阶段 (下拉框) */}
                      <Select
                        size="small"
                        value={op.stage}
                        style={{ width: "100%" }}
                        variant="filled"
                        onChange={(val) => updateStageMutation.mutate({ id: op.id, stage: val })}
                        options={STAGES.map((s) => ({ label: s, value: s }))}
                      />
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <OpportunityFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialValues={editingOp}
        onSuccess={() => {
          setIsModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["opportunities"] });
        }}
      />
    </div>
  );
}