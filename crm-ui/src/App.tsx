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

// ✅ 新增：Opportunities
import OpportunitiesBoard from "./pages/opportunities/OpportunitiesBoard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* 默认进入 Dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* ✅ 新增：Opportunities 路由 */}
        <Route path="opportunities" element={<OpportunitiesBoard />} />

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