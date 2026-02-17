// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Home from "./pages/home/Home";

// Dashboard
import DashboardPage from "./pages/dashboard/DashboardPage";

// Activities
import ActivitiesList from "./pages/activities/ActivitiesList";

// Customers
import CustomersList from "./pages/customers/CustomersList";
import CustomerDetail from "./pages/customers/CustomerDetail";
import CustomerEdit from "./pages/customers/CustomerEdit";
import CustomerCreate from "./pages/customers/CustomerCreate";

// Contacts
import ContactsList from "./pages/contacts/ContactsList";

// Tasks
import TasksList from "./pages/tasks/TasksList";

// Calendar
import CalendarPage from "./pages/calendar/CalendarPage";
import CalendarPageDnD from "./pages/calendar/CalendarPage.DnD";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* ✅ 默认进入 Dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* ✅ Dashboard */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Home */}
        <Route path="home" element={<Home />} />

        {/* Customers */}
        <Route path="customers" element={<CustomersList />} />
        <Route path="customers/new" element={<CustomerCreate />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="customers/:id/edit" element={<CustomerEdit />} />

        {/* Contacts */}
        <Route path="contacts" element={<ContactsList />} />

        {/* Tasks */}
        <Route path="tasks" element={<TasksList />} />

        {/* Activities */}
        <Route path="activities" element={<ActivitiesList />} />

        {/* Calendar */}
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="calendar-dnd" element={<CalendarPageDnD />} />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}


// // src/App.tsx
// import { Navigate, Route, Routes } from "react-router-dom";

// import MainLayout from "./layouts/MainLayout";
// import Home from "./pages/home/Home";

// // Dashboard
// import DashboardPage from "./pages/dashboard/DashboardPage";

// // Activities
// import ActivitiesList from "./pages/activities/ActivitiesList";

// // Customers
// import CustomersList from "./pages/customers/CustomersList";
// import CustomerDetail from "./pages/customers/CustomerDetail";
// import CustomerEdit from "./pages/customers/CustomerEdit";
// import CustomerCreate from "./pages/customers/CustomerCreate";

// // Contacts
// import ContactsList from "./pages/contacts/ContactsList";

// // Tasks
// import TasksList from "./pages/tasks/TasksList";

// // ✅ Calendar（Reservations）
// import CalendarPage from "./pages/calendar/CalendarPage";

// // ✅ Calendar DnD（如果你的文件名不是这个：请改成你项目实际存在的组件路径）
// import CalendarPageDnD from "./pages/calendar/CalendarPage.DnD";

// export default function App() {
//   return (
//     <Routes>
//       {/* 主布局（侧边栏 + 顶部栏） */}
//       <Route path="/" element={<MainLayout />}>
//         {/* ✅ 把 / 重定向到 /dashboard */}
//         <Route index element={<Navigate to="/dashboard" replace />} />

//         {/* ✅ Dashboard */}
//         <Route path="dashboard" element={<DashboardPage />} />

//         {/* Home（保留 /home） */}
//         <Route path="home" element={<Home />} />

//         {/* Customers */}
//         <Route path="customers" element={<CustomersList />} />
//         <Route path="customers/new" element={<CustomerCreate />} />
//         <Route path="customers/:id" element={<CustomerDetail />} />
//         <Route path="customers/:id/edit" element={<CustomerEdit />} />

//         {/* Contacts */}
//         <Route path="contacts" element={<ContactsList />} />

//         {/* Tasks */}
//         <Route path="tasks" element={<TasksList />} />

//         {/* Activities */}
//         <Route path="activities" element={<ActivitiesList />} />

//         {/* ✅ Calendar */}
//         <Route path="calendar" element={<CalendarPage />} />

//         {/* ✅ Calendar DnD */}
//         <Route path="calendar-dnd" element={<CalendarPageDnD />} />

//         {/* 兜底 */}
//         <Route path="*" element={<Navigate to="/dashboard" replace />} />
//       </Route>
//     </Routes>
//   );
// }










// // src/App.tsx
// import { Navigate, Route, Routes } from "react-router-dom";

// import MainLayout from "./layouts/MainLayout";
// import Home from "./pages/home/Home";

// // Dashboard
// import DashboardPage from "./pages/dashboard/DashboardPage";

// // Activities
// import ActivitiesList from "./pages/activities/ActivitiesList";

// // Customers
// import CustomersList from "./pages/customers/CustomersList";
// import CustomerDetail from "./pages/customers/CustomerDetail";
// import CustomerEdit from "./pages/customers/CustomerEdit";
// import CustomerCreate from "./pages/customers/CustomerCreate";

// // Contacts
// import ContactsList from "./pages/contacts/ContactsList";

// // Tasks
// import TasksList from "./pages/tasks/TasksList";

// export default function App() {
//   return (
//     <Routes>
//       {/* 主布局（侧边栏 + 顶部栏） */}
//       <Route path="/" element={<MainLayout />}>
//         {/* ✅ 可选：把 / 重定向到 /dashboard */}
//         <Route index element={<Navigate to="/dashboard" replace />} />

//         {/* ✅ Dashboard */}
//         <Route path="dashboard" element={<DashboardPage />} />

//         {/* 保留 Home（放到 /home） */}
//         <Route path="home" element={<Home />} />

//         {/* 客户模块 */}
//         <Route path="customers" element={<CustomersList />} />
//         <Route path="customers/new" element={<CustomerCreate />} />
//         <Route path="customers/:id" element={<CustomerDetail />} />
//         <Route path="customers/:id/edit" element={<CustomerEdit />} />

//         {/* 联系人模块 */}
//         <Route path="contacts" element={<ContactsList />} />

//         {/* 任务模块 */}
//         <Route path="tasks" element={<TasksList />} />

//         {/* Activities（跟进记录） */}
//         <Route path="activities" element={<ActivitiesList />} />

//         {/* Calendar：你当前项目里已有 /calendar /calendar-dnd（这里先不动，不强行加路由，避免与你现有实现冲突） */}

//         {/* 兜底 */}
//         <Route path="*" element={<Navigate to="/dashboard" replace />} />
//       </Route>
//     </Routes>
//   );
// }












// // import { Navigate, Route, Routes } from "react-router-dom";
// // import MainLayout from "./layouts/MainLayout";

// // import Home from "./pages/home/Home";

// // // ✅ Customers
// // import CustomersList from "./pages/customers/CustomersList";
// // import CustomerDetail from "./pages/customers/CustomerDetail";
// // import CustomerEdit from "./pages/customers/CustomerEdit";
// // import CustomerCreate from "./pages/customers/CustomerCreate";

// // // ✅ Contacts
// // import ContactsList from "./pages/contacts/ContactsList";

// // // ✅ Tasks
// // import TasksList from "./pages/tasks/TasksList";

// // // ✅ Activities
// // import ActivitiesList from "./pages/activities/ActivitiesList";

// // // ✅ Calendar（Reservations）
// // import CalendarPage from "./pages/calendar/CalendarPage";

// // // ✅ Calendar DnD（FullCalendar 拖拽/拉伸版）
// // import CalendarPageDnD from "./pages/calendar/CalendarPage.DnD";

// // export default function App() {
// //   return (
// //     <Routes>
// //       <Route element={<MainLayout />}>
// //         <Route path="/" element={<Home />} />

// //         {/* Customers */}
// //         <Route path="/customers" element={<CustomersList />} />
// //         <Route path="/customers/new" element={<CustomerCreate />} />
// //         <Route path="/customers/:id/edit" element={<CustomerEdit />} />
// //         <Route path="/customers/:id" element={<CustomerDetail />} />

// //         {/* Contacts */}
// //         <Route path="/contacts" element={<ContactsList />} />

// //         {/* Tasks */}
// //         <Route path="/tasks" element={<TasksList />} />

// //         {/* Activities */}
// //         <Route path="/activities" element={<ActivitiesList />} />

// //         {/* ✅ Calendar */}
// //         <Route path="/calendar" element={<CalendarPage />} />

// //         {/* ✅ Calendar Drag & Drop / Resize (验证 end_time + PUT) */}
// //         <Route path="/calendar-dnd" element={<CalendarPageDnD />} />

// //         {/* Fallback */}
// //         <Route path="*" element={<Navigate to="/" replace />} />
// //       </Route>
// //     </Routes>
// //   );
// // }







// // import { Navigate, Route, Routes } from "react-router-dom";
// // import MainLayout from "./layouts/MainLayout";
// // import CalendarPage from "./pages/calendar/CalendarPage";

// // import Home from "./pages/home/Home";

// // // ✅ Customers
// // import CustomersList from "./pages/customers/CustomersList";
// // import CustomerDetail from "./pages/customers/CustomerDetail";
// // import CustomerEdit from "./pages/customers/CustomerEdit";
// // import CustomerCreate from "./pages/customers/CustomerCreate";

// // // ✅ Contacts
// // import ContactsList from "./pages/contacts/ContactsList";

// // // ✅ Tasks
// // import TasksList from "./pages/tasks/TasksList";

// // // ✅ Activities（合并 Notes + Events）
// // import ActivitiesList from "./pages/activities/ActivitiesList";

// // export default function App() {
// //   return (
// //     <Routes>
// //       {/* 所有页面都套上统一的 CRM 外壳 */}
// //       <Route element={<MainLayout />}>
// //         <Route path="/" element={<Home />} />

// //         {/* 客户模块 */}
// //         <Route path="/customers" element={<CustomersList />} />
// //         <Route path="/customers/new" element={<CustomerCreate />} />
// //         <Route path="/customers/:id/edit" element={<CustomerEdit />} />
// //         <Route path="/customers/:id" element={<CustomerDetail />} />

// //         {/* 联系人模块 */}
// //         <Route path="/contacts" element={<ContactsList />} />

// //         {/* 任务模块 */}
// //         <Route path="/tasks" element={<TasksList />} />

// //         {/* Activities（All Activity） */}
// //         <Route path="/activities" element={<ActivitiesList />} />

// //         {/* 兜底 */}
// //         <Route path="*" element={<Navigate to="/" replace />} />
// //       </Route>
// //     </Routes>
// //   );
// // }
