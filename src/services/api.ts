import type { Barber, Service, Appointment, AppStats, User } from "../types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

let accessToken = localStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken || null;
  refreshToken = tokens?.refreshToken || null;
  if (tokens) {
    localStorage.setItem("accessToken", tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
}

const toAppointmentPayload = (body: Partial<Appointment>) => ({
  clientName: body.client_name,
  clientPhone: body.client_phone,
  clientEmail: body.client_email || undefined,
  barberId: body.barber_id,
  serviceId: body.service_id,
  appointmentDate: body.appointment_date,
  appointmentTime: body.appointment_time,
  status: body.status,
  notes: body.notes,
});

const normalizeActivePayload = <T extends { active?: any }>(body: T) => ({
  ...body,
  ...(body.active !== undefined ? { active: Boolean(Number(body.active)) } : {}),
});

const normalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  if ("appointmentDate" in value) {
    return {
      ...value,
      client_name: value.clientName,
      client_phone: value.clientPhone,
      client_email: value.clientEmail,
      barber_id: value.barber?.id,
      service_id: value.service?.id,
      appointment_date: value.appointmentDate,
      appointment_time: String(value.appointmentTime).slice(0, 5),
      barber_name: value.barber?.name,
      service_name: value.service?.name,
      service_duration: value.service?.duration,
      service_price: Number(value.service?.price),
      created_at: value.createdAt,
      updated_at: value.updatedAt,
    };
  }
  if ("isActive" in value) {
    return { ...value, username: value.email, active: value.isActive ? 1 : 0, created_at: value.createdAt };
  }
  if ("price" in value) {
    return { ...value, price: Number(value.price), active: value.active ? 1 : 0, created_at: value.createdAt, updated_at: value.updatedAt };
  }
  if ("active" in value) {
    return { ...value, active: value.active ? 1 : 0, created_at: value.createdAt, updated_at: value.updatedAt };
  }
  return value;
};

async function rawReq<T>(url: string, opts?: RequestInit, includeAuth = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      headers: {
        "Content-Type": "application/json",
        ...(includeAuth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...opts,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const fallback =
      res.status === 401 ? "No autorizado. Inicia sesion nuevamente." :
      res.status === 403 ? "No tienes permiso para realizar esta accion." :
      res.status >= 500 ? "Error interno del servidor. Intenta nuevamente." :
      "Error en la solicitud";
    throw new ApiError(res.status >= 500 ? fallback : data.message || fallback, res.status);
  }
  return normalize(data.data);
}

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  try {
    return await rawReq<T>(url, opts);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && refreshToken && url !== "/login" && url !== "/refresh") {
      try {
        const tokens = await rawReq<{ accessToken: string; refreshToken: string }>("/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }, false);
        setTokens(tokens);
        return await rawReq<T>(url, opts);
      } catch {
        setTokens(null);
      }
    }
    throw error;
  }
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    req<{ accessToken: string; refreshToken: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ email: username, password }),
    }),
  refresh: () => req<{ accessToken: string; refreshToken: string }>("/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }),
  logout: () => req<void>("/logout", { method: "POST" }),
  me: () => req<User>("/users/me"),
  getUsers: () => req<User[]>("/users"),
  createUser: (body: Partial<User> & { password: string }) =>
    req<User>(body.role === "Admin" ? "/admin/register" : "/register", {
      method: "POST",
      body: JSON.stringify({ email: body.username, password: body.password }),
    }),
  updateUser: (id: string, body: Partial<User> & { password?: string }) =>
    req<User>(`/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: Boolean(body.active) }),
    }),
  updateSubscriptionExpiration: (id: string, subscriptionExpirationDate: string) =>
    req<User>(`/users/${id}/subscription-expiration`, {
      method: "PATCH",
      body: JSON.stringify({ subscriptionExpirationDate }),
    }),
  deleteUser: (id: string) =>
    req<void>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }),
};

// Barbers
export const barbersApi = {
  getAll: () => req<Barber[]>("/barbers"),
  getAllAdmin: () => req<Barber[]>("/barbers/all"),
  getById: (id: string) => req<Barber>(`/barbers/${id}`),
  create: (body: Partial<Barber>) =>
    req<Barber>("/barbers", { method: "POST", body: JSON.stringify(normalizeActivePayload(body)) }),
  update: (id: string, body: Partial<Barber>) =>
    req<Barber>(`/barbers/${id}`, {
      method: "PUT",
      body: JSON.stringify(normalizeActivePayload(body)),
    }),
  remove: (id: string) => req<void>(`/barbers/${id}`, { method: "DELETE" }),
};

// Services
export const servicesApi = {
  getAll: () => req<Service[]>("/services"),
  getAllAdmin: () => req<Service[]>("/services/all"),
  getById: (id: string) => req<Service>(`/services/${id}`),
  create: (body: Partial<Service>) =>
    req<Service>("/services", { method: "POST", body: JSON.stringify(normalizeActivePayload(body)) }),
  update: (id: string, body: Partial<Service>) =>
    req<Service>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(normalizeActivePayload(body)),
    }),
  remove: (id: string) => req<void>(`/services/${id}`, { method: "DELETE" }),
};

// Appointments
export const appointmentsApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<Appointment[]>(`/appointments${qs}`);
  },
  getById: (id: string) => req<Appointment>(`/appointments/${id}`),
  getAvailableSlots: (params: {
    barber_id: string;
    date: string;
    service_id?: string;
  }) =>
    req<string[]>(
      `/appointments/available-slots?${new URLSearchParams(params).toString()}`,
    ),
  create: (body: Partial<Appointment>) =>
    req<Appointment>("/appointments", {
      method: "POST",
      body: JSON.stringify(toAppointmentPayload(body)),
    }),
  update: (id: string, body: Partial<Appointment>) =>
    req<Appointment>(`/appointments/${id}`, {
      method: "PUT",
      body: JSON.stringify(toAppointmentPayload(body)),
    }),
  updateStatus: (id: string, status: string) =>
    req<void>(`/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  cancel: (id: string) =>
    req<void>(`/appointments/${id}`, { method: "DELETE" }),
  getStats: () => req<AppStats>("/appointments/stats"),
};
