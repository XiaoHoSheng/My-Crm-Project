import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Spin, Tag, Modal, message, Empty } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, DollarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragOverlay, 
  defaultDropAnimationSideEffects, 
  DragStartEvent, 
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { fetchOpportunities, updateOpportunityStage, deleteOpportunity, STAGES, Opportunity } from "../../api/opportunities";
import OpportunityFormModal from "./OpportunityFormModal";

// 颜色配置
const STAGE_COLORS: Record<string, string> = {
  New: "#1677ff",
  Discovery: "#13c2c2",
  Proposal: "#fa8c16",
  Negotiation: "#722ed1",
  Won: "#52c41a",
  Lost: "#ff4d4f",
};

// ==========================================
// 1. 可拖拽的卡片组件 (Draggable Card)
// ==========================================
function DraggableCard({ op, onClickEdit, onClickDelete }: { op: Opportunity, onClickEdit: (o: Opportunity) => void, onClickDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${op.id}`,
    data: { ...op }, // 把数据带上，方便拖拽层显示
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1, // 拖拽时原位置变半透明
    cursor: "grab",
    marginBottom: 12,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        hoverable
        size="small"
        style={{ borderRadius: 8, boxShadow: isDragging ? "none" : "0 2px 4px rgba(0,0,0,0.02)" }}
        actions={[
          // 注意：点击事件需要阻止冒泡，否则可能会触发拖拽
          <EditOutlined key="edit" onPointerDown={(e) => e.stopPropagation()} onClick={() => onClickEdit(op)} />,
          <DeleteOutlined key="del" onPointerDown={(e) => e.stopPropagation()} onClick={() => onClickDelete(op.id)} />,
        ]}
      >
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
          🏢 {op.customerName || "Unknown"}
        </div>
        <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 8, lineHeight: 1.4 }}>
          {op.name}
        </div>
        <div style={{ color: "#1677ff", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          <DollarOutlined /> {op.amount?.toLocaleString()}
        </div>
        {op.closingDate && (
          <div style={{ fontSize: 12, color: "#999" }}>
            📅 {dayjs(op.closingDate).format("MMM D")}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// 2. 可放置的列组件 (Droppable Column)
// ==========================================
function DroppableColumn({ stage, opportunities, onEdit, onDelete }: { 
  stage: string, 
  opportunities: Opportunity[],
  onEdit: (op: Opportunity) => void,
  onDelete: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage, // 列的 ID 就是阶段名 (New, Won...)
  });

  const totalAmount = opportunities.reduce((sum, o) => sum + (o.amount || 0), 0);

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: 280,
        background: isOver ? "#e6f7ff" : "#f7f7f7", // 拖拽经过时变色
        padding: "12px",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        borderTop: `4px solid ${STAGE_COLORS[stage] || "#ccc"}`,
        transition: "background 0.2s",
      }}
    >
      {/* 列头 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 16 }}>{stage}</strong>
          <Tag>{opportunities.length}</Tag>
        </div>
        <div style={{ color: "#555", fontWeight: 500 }}>
          ${totalAmount.toLocaleString()}
        </div>
      </div>

      {/* 卡片列表 */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 100 }}>
        {opportunities.map((op) => (
          <DraggableCard key={op.id} op={op} onClickEdit={onEdit} onClickDelete={onDelete} />
        ))}
        {opportunities.length === 0 && (
          <div style={{ height: "100%", display: "flex", justifyContent: "center", alignItems: "center", opacity: 0.5 }}>
             <span style={{ fontSize: 12 }}>Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. 主看板组件
// ==========================================
export default function OpportunitiesBoard() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Opportunity | null>(null);
  
  // 拖拽状态：当前正在拖拽的卡片数据（用于显示浮层）
  const [activeOp, setActiveOp] = useState<Opportunity | null>(null);

  // 传感器：处理鼠标和触摸事件
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 移动 5px 后才开始拖拽，防止点击事件误触
      },
    })
  );

  // 1. 获取数据
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
  });

  // 2. 更新阶段 API
  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) => updateOpportunityStage(id, stage),
    onSuccess: () => {
      // 成功后刷新数据（其实我们下面会做乐观更新，但这里保底刷新）
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      message.success("Stage moved!");
    },
    onError: () => {
       message.error("Failed to move.");
       queryClient.invalidateQueries({ queryKey: ["opportunities"] }); // 失败回滚
    }
  });

  // 3. 删除 API
  const deleteMutation = useMutation({
    mutationFn: deleteOpportunity,
    onSuccess: () => {
      message.success("Deleted!");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  // 处理拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    // data.current 是我们在 DraggableCard 里传进去的 op
    const op = event.active.data.current as Opportunity;
    setActiveOp(op);
  };

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOp(null);

    if (!over) return; // 没拖到任何有效的列上

    const cardIdStr = active.id as string; // "card-123"
    const opportunityId = parseInt(cardIdStr.replace("card-", ""));
    const newStage = over.id as string; // "Won"

    // 找到原始数据
    const op = opportunities.find(o => o.id === opportunityId);
    if (!op) return;

    // 如果阶段没变，啥也不做
    if (op.stage === newStage) return;

    // ✅ 乐观更新 (Optimistic Update)：先改界面，再发请求
    // 这样用户感觉不到延迟
    queryClient.setQueryData(["opportunities"], (old: Opportunity[] | undefined) => {
      if (!old) return [];
      return old.map(o => o.id === opportunityId ? { ...o, stage: newStage } : o);
    });

    // 发送请求
    updateStageMutation.mutate({ id: opportunityId, stage: newStage });
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: "Delete this deal?",
      okType: 'danger',
      onOk: () => deleteMutation.mutate(id),
    });
  };

  if (isLoading) return <Spin size="large" className="block m-10" />;

  return (
    <div style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Sales Pipeline</h1>
          <span style={{ color: "#888" }}>Drag cards to move stages</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { setEditingOp(null); setIsModalOpen(true); }}>
          New Deal
        </Button>
      </div>

      {/* 拖拽上下文容器 */}
      <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <div style={{ flex: 1, overflowX: "auto", paddingBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, minWidth: 1600, height: "100%" }}>
            {STAGES.map((stage) => {
              const ops = opportunities.filter((o) => o.stage === stage);
              return (
                <DroppableColumn 
                  key={stage} 
                  stage={stage} 
                  opportunities={ops} 
                  onEdit={(op) => { setEditingOp(op); setIsModalOpen(true); }}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        </div>

        {/* 拖拽时跟随鼠标的浮层 */}
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeOp ? (
             <Card size="small" style={{ width: 260, cursor: "grabbing", boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}>
                <div style={{ fontWeight: "bold" }}>{activeOp.name}</div>
                <div style={{ color: "#1677ff" }}>${activeOp.amount?.toLocaleString()}</div>
             </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

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