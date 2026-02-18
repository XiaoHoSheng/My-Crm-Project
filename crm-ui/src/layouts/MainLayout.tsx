// src/layouts/MainLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { Layout, Menu, Grid, Button } from "antd";
import {
  HomeOutlined,
  TeamOutlined,
  ContactsOutlined,
  CheckSquareOutlined,
  CalendarOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RiseOutlined, // ✅ 新增：商机图标
} from "@ant-design/icons";
import { useMemo, useState } from "react";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

function getSelectedKey(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "/dashboard";
  if (pathname.startsWith("/opportunities")) return "/opportunities"; // ✅ 新增
  if (pathname.startsWith("/customers")) return "/customers";
  if (pathname.startsWith("/contacts")) return "/contacts";
  if (pathname.startsWith("/tasks")) return "/tasks";
  if (pathname.startsWith("/activities")) return "/activities";
  if (pathname.startsWith("/calendar-dnd")) return "/calendar-dnd";
  if (pathname.startsWith("/calendar")) return "/calendar";
  if (pathname.startsWith("/home")) return "/home";
  return "/dashboard";
}

export default function MainLayout() {
  const location = useLocation();
  const screens = useBreakpoint();

  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);

  const selectedKey = useMemo(
    () => getSelectedKey(location.pathname),
    [location.pathname]
  );

  return (
    <Layout className="crm-layout">
      <Sider
        className="crm-sider"
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        onBreakpoint={(isBroken) => {
          setBroken(isBroken);
          setCollapsed(isBroken);
        }}
        collapsedWidth={broken ? 0 : 80}
        width={220}
      >
        <div className="crm-logo">
          <span className="crm-logo-badge">CRM</span>
          {!collapsed && <span className="crm-logo-text">My CRM</span>}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: "/dashboard",
              icon: <DashboardOutlined />,
              label: <Link to="/dashboard">Dashboard</Link>,
            },
            // ✅ 新增：Opportunities 菜单项
            {
              key: "/opportunities",
              icon: <RiseOutlined />,
              label: <Link to="/opportunities">Opportunities</Link>,
            },
            {
              key: "/home",
              icon: <HomeOutlined />,
              label: <Link to="/home">Home</Link>,
            },
            {
              key: "/customers",
              icon: <TeamOutlined />,
              label: <Link to="/customers">Customers</Link>,
            },
            {
              key: "/contacts",
              icon: <ContactsOutlined />,
              label: <Link to="/contacts">Contacts</Link>,
            },
            {
              key: "/tasks",
              icon: <CheckSquareOutlined />,
              label: <Link to="/tasks">Tasks</Link>,
            },
            {
              key: "/activities",
              icon: <CalendarOutlined />,
              label: <Link to="/activities">Activities</Link>,
            },
            {
              key: "/calendar",
              icon: <CalendarOutlined />,
              label: <Link to="/calendar">Calendar</Link>,
            },
            {
              key: "/calendar-dnd",
              icon: <CalendarOutlined />,
              label: <Link to="/calendar-dnd">Calendar DnD</Link>,
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header className="crm-header">
          <div className="crm-header-left">
            {!screens.lg && (
              <Button
                type="text"
                className="crm-sider-trigger"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((v) => !v)}
              />
            )}
            <div className="crm-header-title">CRM System</div>
          </div>

          <div className="crm-header-right">
            <span className="crm-user">Jason</span>
          </div>
        </Header>

        <Content className="crm-content">
          <div className="crm-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}