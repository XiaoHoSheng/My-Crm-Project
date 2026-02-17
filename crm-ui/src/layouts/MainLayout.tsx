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
} from "@ant-design/icons";
import { useMemo, useState } from "react";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

function getSelectedKey(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "/dashboard";
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










// // src/layouts/MainLayout.tsx
// import { Link, Outlet, useLocation } from "react-router-dom";
// import { Layout, Menu, Grid, Button } from "antd";
// import {
//   HomeOutlined,
//   TeamOutlined,
//   ContactsOutlined,
//   CheckSquareOutlined,
//   CalendarOutlined,
//   DashboardOutlined,
//   MenuFoldOutlined,
//   MenuUnfoldOutlined,
// } from "@ant-design/icons";
// import { useMemo, useState } from "react";

// const { Header, Sider, Content } = Layout;
// const { useBreakpoint } = Grid;

// function getSelectedKey(pathname: string) {
//   if (pathname.startsWith("/dashboard")) return "/dashboard";
//   if (pathname.startsWith("/customers")) return "/customers";
//   if (pathname.startsWith("/contacts")) return "/contacts";
//   if (pathname.startsWith("/tasks")) return "/tasks";
//   if (pathname.startsWith("/activities")) return "/activities";
//   if (pathname.startsWith("/calendar")) return "/calendar";
//   if (pathname.startsWith("/home")) return "/home";
//   return "/dashboard";
// }

// export default function MainLayout() {
//   const location = useLocation();
//   const screens = useBreakpoint();

//   const [collapsed, setCollapsed] = useState(false);
//   const [broken, setBroken] = useState(false);

//   const selectedKey = useMemo(
//     () => getSelectedKey(location.pathname),
//     [location.pathname]
//   );

//   return (
//     <Layout className="crm-layout">
//       <Sider
//         className="crm-sider"
//         trigger={null}
//         collapsible
//         collapsed={collapsed}
//         onCollapse={setCollapsed}
//         breakpoint="lg"
//         onBreakpoint={(isBroken) => {
//           setBroken(isBroken);
//           setCollapsed(isBroken);
//         }}
//         collapsedWidth={broken ? 0 : 80}
//         width={220}
//       >
//         <div className="crm-logo">
//           <span className="crm-logo-badge">CRM</span>
//           {!collapsed && <span className="crm-logo-text">My CRM</span>}
//         </div>

//         <Menu
//           theme="dark"
//           mode="inline"
//           selectedKeys={[selectedKey]}
//           items={[
//             {
//               key: "/dashboard",
//               icon: <DashboardOutlined />,
//               label: <Link to="/dashboard">Dashboard</Link>,
//             },
//             {
//               key: "/home",
//               icon: <HomeOutlined />,
//               label: <Link to="/home">Home</Link>,
//             },
//             {
//               key: "/customers",
//               icon: <TeamOutlined />,
//               label: <Link to="/customers">Customers</Link>,
//             },
//             {
//               key: "/contacts",
//               icon: <ContactsOutlined />,
//               label: <Link to="/contacts">Contacts</Link>,
//             },
//             {
//               key: "/tasks",
//               icon: <CheckSquareOutlined />,
//               label: <Link to="/tasks">Tasks</Link>,
//             },
//             {
//               key: "/activities",
//               icon: <CalendarOutlined />,
//               label: <Link to="/activities">Activities</Link>,
//             },
//             // Calendar：你现有项目里有 /calendar（如果你菜单里已经加过了，这里可以不加；第2步再统一对齐）
//             {
//               key: "/calendar",
//               icon: <CalendarOutlined />,
//               label: <Link to="/calendar">Calendar</Link>,
//             },
//             {
//               key: "/calendar-dnd",
//               icon: <CalendarOutlined />,
//               label: <Link to="/calendar-dnd">Calendar DnD</Link>,
//             },
//           ]}
//         />
//       </Sider>

//       <Layout>
//         <Header className="crm-header">
//           <div className="crm-header-left">
//             {!screens.lg && (
//               <Button
//                 type="text"
//                 className="crm-sider-trigger"
//                 icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
//                 onClick={() => setCollapsed((v) => !v)}
//               />
//             )}

//             <div className="crm-header-title">CRM System</div>
//           </div>

//           <div className="crm-header-right">
//             <span className="crm-user">Jason</span>
//           </div>
//         </Header>

//         <Content className="crm-content">
//           <div className="crm-content-inner">
//             <Outlet />
//           </div>
//         </Content>
//       </Layout>
//     </Layout>
//   );
// }




















// import { Link, Outlet, useLocation } from "react-router-dom";
// import { Layout, Menu, Grid } from "antd";
// import {
//   HomeOutlined,
//   TeamOutlined,
//   ContactsOutlined,
//   CheckSquareOutlined,
//   CalendarOutlined,
//   ScheduleOutlined,
// } from "@ant-design/icons";
// import { useMemo, useState } from "react";

// const { Header, Sider, Content } = Layout;
// const { useBreakpoint } = Grid;

// function getSelectedKey(pathname: string) {
//   if (pathname.startsWith("/customers")) return "/customers";
//   if (pathname.startsWith("/contacts")) return "/contacts";
//   if (pathname.startsWith("/tasks")) return "/tasks";
//   if (pathname.startsWith("/activities")) return "/activities";
//   if (pathname.startsWith("/calendar")) return "/calendar";
//   return "/";
// }

// export default function MainLayout() {
//   const location = useLocation();
//   const screens = useBreakpoint();
//   const [collapsed, setCollapsed] = useState(false);

//   const selectedKey = useMemo(
//     () => getSelectedKey(location.pathname),
//     [location.pathname]
//   );

//   return (
//     <Layout className="crm-layout">
//       <Sider
//         className="crm-sider"
//         collapsible
//         collapsed={collapsed}
//         onCollapse={setCollapsed}
//         breakpoint="lg"
//         collapsedWidth={screens.lg ? 80 : 0}
//         width={220}
//       >
//         <div className="crm-logo">
//           <span className="crm-logo-badge">CRM</span>
//           {!collapsed && <span className="crm-logo-text">My CRM</span>}
//         </div>

//         <Menu
//           theme="dark"
//           mode="inline"
//           selectedKeys={[selectedKey]}
//           items={[
//             {
//               key: "/",
//               icon: <HomeOutlined />,
//               label: <Link to="/">Home</Link>,
//             },
//             {
//               key: "/customers",
//               icon: <TeamOutlined />,
//               label: <Link to="/customers">Customers</Link>,
//             },
//             {
//               key: "/contacts",
//               icon: <ContactsOutlined />,
//               label: <Link to="/contacts">Contacts</Link>,
//             },
//             {
//               key: "/tasks",
//               icon: <CheckSquareOutlined />,
//               label: <Link to="/tasks">Tasks</Link>,
//             },
//             {
//               key: "/activities",
//               icon: <CalendarOutlined />,
//               label: <Link to="/activities">Activities</Link>,
//             },
//             // ✅ 新增：Calendar（日程/预约）
//             {
//               key: "/calendar",
//               icon: <ScheduleOutlined />,
//               label: <Link to="/calendar">Calendar</Link>,
//             },
//           ]}
//         />
//       </Sider>

//       <Layout>
//         <Header className="crm-header">
//           <div className="crm-header-left">
//             <div className="crm-header-title">CRM System</div>
//           </div>

//           <div className="crm-header-right">
//             <span className="crm-user">Jason</span>
//           </div>
//         </Header>

//         <Content className="crm-content">
//           <div className="crm-content-inner">
//             <Outlet />
//           </div>
//         </Content>
//       </Layout>
//     </Layout>
//   );
// }





// // import { Link, Outlet, useLocation } from "react-router-dom";
// // import { Layout, Menu, Grid, Button } from "antd";
// // import {
// //   HomeOutlined,
// //   TeamOutlined,
// //   ContactsOutlined,
// //   CheckSquareOutlined,
// //   MenuFoldOutlined,
// //   MenuUnfoldOutlined,
// // } from "@ant-design/icons";
// // import { useMemo, useState } from "react";

// // const { Header, Sider, Content } = Layout;
// // const { useBreakpoint } = Grid;

// // function getSelectedKey(pathname: string) {
// //   if (pathname.startsWith("/customers")) return "/customers";
// //   if (pathname.startsWith("/contacts")) return "/contacts";
// //   if (pathname.startsWith("/tasks")) return "/tasks";
// //   return "/";
// // }

// // export default function MainLayout() {
// //   const location = useLocation();
// //   const screens = useBreakpoint();

// //   const [collapsed, setCollapsed] = useState(false);
// //   const [broken, setBroken] = useState(false);

// //   const selectedKey = useMemo(
// //     () => getSelectedKey(location.pathname),
// //     [location.pathname]
// //   );

// //   return (
// //     <Layout className="crm-layout">
// //       <Sider
// //         className="crm-sider"
// //         trigger={null}
// //         collapsible
// //         collapsed={collapsed}
// //         onCollapse={setCollapsed}
// //         breakpoint="lg"
// //         onBreakpoint={(isBroken) => {
// //           setBroken(isBroken);
// //           setCollapsed(isBroken); // ✅ 小屏默认收起，避免挤压内容区导致半屏“看不见/变形”
// //         }}
// //         collapsedWidth={broken ? 0 : 80}
// //         width={220}
// //       >
// //         <div className="crm-logo">
// //           <span className="crm-logo-badge">CRM</span>
// //           {!collapsed && <span className="crm-logo-text">My CRM</span>}
// //         </div>

// //         <Menu
// //           theme="dark"
// //           mode="inline"
// //           selectedKeys={[selectedKey]}
// //           items={[
// //             {
// //               key: "/",
// //               icon: <HomeOutlined />,
// //               label: <Link to="/">Home</Link>,
// //             },
// //             {
// //               key: "/customers",
// //               icon: <TeamOutlined />,
// //               label: <Link to="/customers">Customers</Link>,
// //             },
// //             {
// //               key: "/contacts",
// //               icon: <ContactsOutlined />,
// //               label: <Link to="/contacts">Contacts</Link>,
// //             },
// //             {
// //               key: "/tasks",
// //               icon: <CheckSquareOutlined />,
// //               label: <Link to="/tasks">Tasks</Link>,
// //             },
// //           ]}
// //         />
// //       </Sider>

// //       <Layout>
// //         <Header className="crm-header">
// //           <div className="crm-header-left">
// //             {/* ✅ 小屏显示“汉堡按钮”，用于展开侧边栏 */}
// //             {!screens.lg && (
// //               <Button
// //                 type="text"
// //                 className="crm-sider-trigger"
// //                 icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
// //                 onClick={() => setCollapsed((v) => !v)}
// //               />
// //             )}

// //             <div className="crm-header-title">CRM System</div>
// //           </div>

// //           <div className="crm-header-right">
// //             <span className="crm-user">Jason</span>
// //           </div>
// //         </Header>

// //         <Content className="crm-content">
// //           <div className="crm-content-inner">
// //             <Outlet />
// //           </div>
// //         </Content>
// //       </Layout>
// //     </Layout>
// //   );
// // }













// // src/layouts/MainLayout.tsx
// import { Link, Outlet, useLocation } from "react-router-dom";
// import { Layout, Menu, Grid, Button } from "antd";
// import {
//   HomeOutlined,
//   TeamOutlined,
//   ContactsOutlined,
//   CheckSquareOutlined,
//   CalendarOutlined,
//   DashboardOutlined,
//   MenuFoldOutlined,
//   MenuUnfoldOutlined,
// } from "@ant-design/icons";
// import { useMemo, useState } from "react";

// const { Header, Sider, Content } = Layout;
// const { useBreakpoint } = Grid;

// function getSelectedKey(pathname: string) {
//   if (pathname.startsWith("/dashboard")) return "/dashboard";
//   if (pathname.startsWith("/customers")) return "/customers";
//   if (pathname.startsWith("/contacts")) return "/contacts";
//   if (pathname.startsWith("/tasks")) return "/tasks";
//   if (pathname.startsWith("/activities")) return "/activities";
//   if (pathname.startsWith("/calendar")) return "/calendar";
//   if (pathname.startsWith("/home")) return "/home";
//   return "/dashboard";
// }

// export default function MainLayout() {
//   const location = useLocation();
//   const screens = useBreakpoint();

//   const [collapsed, setCollapsed] = useState(false);
//   const [broken, setBroken] = useState(false);

//   const selectedKey = useMemo(
//     () => getSelectedKey(location.pathname),
//     [location.pathname]
//   );

//   return (
//     <Layout className="crm-layout">
//       <Sider
//         className="crm-sider"
//         trigger={null}
//         collapsible
//         collapsed={collapsed}
//         onCollapse={setCollapsed}
//         breakpoint="lg"
//         onBreakpoint={(isBroken) => {
//           setBroken(isBroken);
//           setCollapsed(isBroken);
//         }}
//         collapsedWidth={broken ? 0 : 80}
//         width={220}
//       >
//         <div className="crm-logo">
//           <span className="crm-logo-badge">CRM</span>
//           {!collapsed && <span className="crm-logo-text">My CRM</span>}
//         </div>

//         <Menu
//           theme="dark"
//           mode="inline"
//           selectedKeys={[selectedKey]}
//           items={[
//             {
//               key: "/dashboard",
//               icon: <DashboardOutlined />,
//               label: <Link to="/dashboard">Dashboard</Link>,
//             },
//             {
//               key: "/home",
//               icon: <HomeOutlined />,
//               label: <Link to="/home">Home</Link>,
//             },
//             {
//               key: "/customers",
//               icon: <TeamOutlined />,
//               label: <Link to="/customers">Customers</Link>,
//             },
//             {
//               key: "/contacts",
//               icon: <ContactsOutlined />,
//               label: <Link to="/contacts">Contacts</Link>,
//             },
//             {
//               key: "/tasks",
//               icon: <CheckSquareOutlined />,
//               label: <Link to="/tasks">Tasks</Link>,
//             },
//             {
//               key: "/activities",
//               icon: <CalendarOutlined />,
//               label: <Link to="/activities">Activities</Link>,
//             },
//             // Calendar：你现有项目里有 /calendar（如果你菜单里已经加过了，这里可以不加；第2步再统一对齐）
//             {
//               key: "/calendar",
//               icon: <CalendarOutlined />,
//               label: <Link to="/calendar">Calendar</Link>,
//             },
//           ]}
//         />
//       </Sider>

//       <Layout>
//         <Header className="crm-header">
//           <div className="crm-header-left">
//             {!screens.lg && (
//               <Button
//                 type="text"
//                 className="crm-sider-trigger"
//                 icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
//                 onClick={() => setCollapsed((v) => !v)}
//               />
//             )}

//             <div className="crm-header-title">CRM System</div>
//           </div>

//           <div className="crm-header-right">
//             <span className="crm-user">Jason</span>
//           </div>
//         </Header>

//         <Content className="crm-content">
//           <div className="crm-content-inner">
//             <Outlet />
//           </div>
//         </Content>
//       </Layout>
//     </Layout>
//   );
// }




















// // import { Link, Outlet, useLocation } from "react-router-dom";
// // import { Layout, Menu, Grid } from "antd";
// // import {
// //   HomeOutlined,
// //   TeamOutlined,
// //   ContactsOutlined,
// //   CheckSquareOutlined,
// //   CalendarOutlined,
// //   ScheduleOutlined,
// // } from "@ant-design/icons";
// // import { useMemo, useState } from "react";

// // const { Header, Sider, Content } = Layout;
// // const { useBreakpoint } = Grid;

// // function getSelectedKey(pathname: string) {
// //   if (pathname.startsWith("/customers")) return "/customers";
// //   if (pathname.startsWith("/contacts")) return "/contacts";
// //   if (pathname.startsWith("/tasks")) return "/tasks";
// //   if (pathname.startsWith("/activities")) return "/activities";
// //   if (pathname.startsWith("/calendar")) return "/calendar";
// //   return "/";
// // }

// // export default function MainLayout() {
// //   const location = useLocation();
// //   const screens = useBreakpoint();
// //   const [collapsed, setCollapsed] = useState(false);

// //   const selectedKey = useMemo(
// //     () => getSelectedKey(location.pathname),
// //     [location.pathname]
// //   );

// //   return (
// //     <Layout className="crm-layout">
// //       <Sider
// //         className="crm-sider"
// //         collapsible
// //         collapsed={collapsed}
// //         onCollapse={setCollapsed}
// //         breakpoint="lg"
// //         collapsedWidth={screens.lg ? 80 : 0}
// //         width={220}
// //       >
// //         <div className="crm-logo">
// //           <span className="crm-logo-badge">CRM</span>
// //           {!collapsed && <span className="crm-logo-text">My CRM</span>}
// //         </div>

// //         <Menu
// //           theme="dark"
// //           mode="inline"
// //           selectedKeys={[selectedKey]}
// //           items={[
// //             {
// //               key: "/",
// //               icon: <HomeOutlined />,
// //               label: <Link to="/">Home</Link>,
// //             },
// //             {
// //               key: "/customers",
// //               icon: <TeamOutlined />,
// //               label: <Link to="/customers">Customers</Link>,
// //             },
// //             {
// //               key: "/contacts",
// //               icon: <ContactsOutlined />,
// //               label: <Link to="/contacts">Contacts</Link>,
// //             },
// //             {
// //               key: "/tasks",
// //               icon: <CheckSquareOutlined />,
// //               label: <Link to="/tasks">Tasks</Link>,
// //             },
// //             {
// //               key: "/activities",
// //               icon: <CalendarOutlined />,
// //               label: <Link to="/activities">Activities</Link>,
// //             },
// //             // ✅ 新增：Calendar（日程/预约）
// //             {
// //               key: "/calendar",
// //               icon: <ScheduleOutlined />,
// //               label: <Link to="/calendar">Calendar</Link>,
// //             },
// //           ]}
// //         />
// //       </Sider>

// //       <Layout>
// //         <Header className="crm-header">
// //           <div className="crm-header-left">
// //             <div className="crm-header-title">CRM System</div>
// //           </div>

// //           <div className="crm-header-right">
// //             <span className="crm-user">Jason</span>
// //           </div>
// //         </Header>

// //         <Content className="crm-content">
// //           <div className="crm-content-inner">
// //             <Outlet />
// //           </div>
// //         </Content>
// //       </Layout>
// //     </Layout>
// //   );
// // }





// // // import { Link, Outlet, useLocation } from "react-router-dom";
// // // import { Layout, Menu, Grid, Button } from "antd";
// // // import {
// // //   HomeOutlined,
// // //   TeamOutlined,
// // //   ContactsOutlined,
// // //   CheckSquareOutlined,
// // //   MenuFoldOutlined,
// // //   MenuUnfoldOutlined,
// // // } from "@ant-design/icons";
// // // import { useMemo, useState } from "react";

// // // const { Header, Sider, Content } = Layout;
// // // const { useBreakpoint } = Grid;

// // // function getSelectedKey(pathname: string) {
// // //   if (pathname.startsWith("/customers")) return "/customers";
// // //   if (pathname.startsWith("/contacts")) return "/contacts";
// // //   if (pathname.startsWith("/tasks")) return "/tasks";
// // //   return "/";
// // // }

// // // export default function MainLayout() {
// // //   const location = useLocation();
// // //   const screens = useBreakpoint();

// // //   const [collapsed, setCollapsed] = useState(false);
// // //   const [broken, setBroken] = useState(false);

// // //   const selectedKey = useMemo(
// // //     () => getSelectedKey(location.pathname),
// // //     [location.pathname]
// // //   );

// // //   return (
// // //     <Layout className="crm-layout">
// // //       <Sider
// // //         className="crm-sider"
// // //         trigger={null}
// // //         collapsible
// // //         collapsed={collapsed}
// // //         onCollapse={setCollapsed}
// // //         breakpoint="lg"
// // //         onBreakpoint={(isBroken) => {
// // //           setBroken(isBroken);
// // //           setCollapsed(isBroken); // ✅ 小屏默认收起，避免挤压内容区导致半屏“看不见/变形”
// // //         }}
// // //         collapsedWidth={broken ? 0 : 80}
// // //         width={220}
// // //       >
// // //         <div className="crm-logo">
// // //           <span className="crm-logo-badge">CRM</span>
// // //           {!collapsed && <span className="crm-logo-text">My CRM</span>}
// // //         </div>

// // //         <Menu
// // //           theme="dark"
// // //           mode="inline"
// // //           selectedKeys={[selectedKey]}
// // //           items={[
// // //             {
// // //               key: "/",
// // //               icon: <HomeOutlined />,
// // //               label: <Link to="/">Home</Link>,
// // //             },
// // //             {
// // //               key: "/customers",
// // //               icon: <TeamOutlined />,
// // //               label: <Link to="/customers">Customers</Link>,
// // //             },
// // //             {
// // //               key: "/contacts",
// // //               icon: <ContactsOutlined />,
// // //               label: <Link to="/contacts">Contacts</Link>,
// // //             },
// // //             {
// // //               key: "/tasks",
// // //               icon: <CheckSquareOutlined />,
// // //               label: <Link to="/tasks">Tasks</Link>,
// // //             },
// // //           ]}
// // //         />
// // //       </Sider>

// // //       <Layout>
// // //         <Header className="crm-header">
// // //           <div className="crm-header-left">
// // //             {/* ✅ 小屏显示“汉堡按钮”，用于展开侧边栏 */}
// // //             {!screens.lg && (
// // //               <Button
// // //                 type="text"
// // //                 className="crm-sider-trigger"
// // //                 icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
// // //                 onClick={() => setCollapsed((v) => !v)}
// // //               />
// // //             )}

// // //             <div className="crm-header-title">CRM System</div>
// // //           </div>

// // //           <div className="crm-header-right">
// // //             <span className="crm-user">Jason</span>
// // //           </div>
// // //         </Header>

// // //         <Content className="crm-content">
// // //           <div className="crm-content-inner">
// // //             <Outlet />
// // //           </div>
// // //         </Content>
// // //       </Layout>
// // //     </Layout>
// // //   );
// // // }
