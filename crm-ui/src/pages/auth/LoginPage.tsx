import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login, LoginRequest } from "../../api/auth";

const { Title } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: (values: LoginRequest) => login(values),
    onSuccess: (data) => {
      message.success("登录成功！");
      // 1. 保存 Token 和用户名到浏览器
      localStorage.setItem("crm_token", data.token);
      localStorage.setItem("crm_username", data.username);
      // 2. 跳转到 Dashboard
      navigate("/dashboard");
    },
    onError: () => {
      // 错误提示已经在 http.ts 拦截器里做过了，这里可以留空
    }
  });

  const onFinish = (values: LoginRequest) => {
    loginMutation.mutate(values);
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f0f2f5"
    }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", borderRadius: 8 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: "#1677ff" }}>My CRM</Title>
          <div style={{ color: "#888", marginTop: 8 }}>Sign in to your account</div>
        </div>

        <Form
          name="login_form"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your Username!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }} loading={loginMutation.isPending}>
              Log in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}