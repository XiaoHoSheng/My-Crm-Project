import { http } from "./http";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
}

export async function login(data: LoginRequest) {
  const res = await http.post<LoginResponse>("/Auth/login", data);
  return res.data;
}

export function logout() {
  localStorage.removeItem("crm_token");
  localStorage.removeItem("crm_username");
  window.location.href = "/login";
}