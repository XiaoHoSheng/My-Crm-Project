import axios from "axios";

export const http = axios.create({
  baseURL: "http://localhost:5295/api",
  timeout: 10000,
});
