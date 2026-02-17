import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h2>CRM Home</h2>
      <p>欢迎来到 CRM 系统</p>

      <div style={{ marginTop: 12 }}>
        <Link to="/customers">进入客户列表</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/customers/new">新增客户</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/contacts">联系人</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/tasks">任务(Tasks)</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/activities">Activities（All Activity）</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/calendar">Calendar（日程 / 预约）</Link>
      </div>
    </div>
  );
}










// import { Link } from "react-router-dom";

// export default function Home() {
//   return (
//     <div style={{ padding: 24 }}>
//       <h2>CRM Home</h2>
//       <p>欢迎来到 CRM 系统</p>

//       <div style={{ marginTop: 12 }}>
//         <Link to="/customers">进入客户列表</Link>
//       </div>

//       <div style={{ marginTop: 12 }}>
//         <Link to="/customers/new">新增客户</Link>
//       </div>

//       <div style={{ marginTop: 12 }}>
//         <Link to="/contacts">联系人</Link>
//       </div>

//       <div style={{ marginTop: 12 }}>
//         <Link to="/tasks">任务(Tasks)</Link>
//       </div>

//       <div style={{ marginTop: 12 }}>
//         <Link to="/activities">Activities（All Activity）</Link>
//       </div>
//     </div>
//   );
// }
