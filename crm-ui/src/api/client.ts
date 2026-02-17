import axios from 'axios'
import { getCustomerEvents } from "@/api/events";

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})
