import { supabase } from "./supabase";
import { notifyCatalogChanged } from "./catalogEvents";
import type { Appointment, AppStats, Barber, Service, User } from "../types";
import { localDate, localTime } from "../utils/booking";
export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
interface DbResult<T> {
  data: T | null;
  error: { message: string } | null;
}
interface StaffProfile {
  id: string;
  email: string;
  active: boolean;
  subscription_expires_at: string | null;
  created_at: string;
  user_roles: { role: string } | null;
  barbers: { id: string; name: string }[];
}
async function result<T>(promise: PromiseLike<DbResult<T>>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new ApiError(error.message);
  return data as T;
}
export async function edge<T>(
  name: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
  });
  if (error) {
    let message = "No se pudo completar la operación. Comprueba tu conexión.";
    if (error.context instanceof Response) {
      const b = await error.context.json().catch(() => null);
      message = b?.message || message;
    }
    throw new ApiError(message);
  }
  if (name === 'admin-users' && ['create', 'update'].includes(String(payload.action))) notifyCatalogChanged();
  return data as T;
}
type DbAppointment = Appointment & {
  starts_at: string;
  barbers?: { name: string } | null;
};
export const normalizeAppointment = (a: DbAppointment): Appointment => ({
  ...a,
  appointment_date: localDate(a.starts_at),
  appointment_time: localTime(a.starts_at),
  barber_name: a.barber_name || a.barbers?.name,
});
const active = <T extends { active: number | boolean }>(row: T) => ({
  ...row,
  active: Number(row.active),
});
export interface Catalog {
  barbers: Barber[];
  services: Service[];
  barber_services: { barber_id: string; service_id: string }[];
  working_weekdays?: { barber_id: string; weekday: number }[];
  settings: { shop_name: string; horizon_days: number };
}
export const catalogApi = {
  get: () =>
    edge<Catalog>("booking", { action: "catalog" }).then((c) => ({
      ...c,
      barbers: c.barbers.map(active),
      services: c.services.map(active),
    })),
};
export interface Slot {
  barber_id: string;
  starts_at: string;
}
export const privateBookingApi = {
  get: (token: string) =>
    edge<Appointment>("booking", { action: "get", token }),
  cancel: (token: string) =>
    edge<Appointment>("booking", { action: "cancel", token }),
  reschedule: (token: string, appointment: Partial<Appointment>) =>
    edge<Appointment>("booking", { action: "reschedule", token, appointment }),
  slots: (token: string, date: string) =>
    edge<Slot[]>("booking", { action: "slots", token, date }),
};
export const setTokens = (_tokens: unknown) => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};
export const authApi = {
  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new ApiError(error.message);
    return null;
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError(error.message);
  },
  me: async (): Promise<User> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new ApiError("Inicia sesión", 401);
    const p = await result(
      supabase.from("profiles").select("*,user_roles(role),barbers(id,name)")
        .eq("id", session.user.id).single<StaffProfile>(),
    );
    if (!p) throw new ApiError("No se encontró el perfil", 403);
    if (
      !p.active ||
      (p.subscription_expires_at &&
        new Date(p.subscription_expires_at) <= new Date())
    ) throw new ApiError("Acceso inactivo o vencido", 403);
    const role = p.user_roles?.role;
    if (!role || !["admin", "barber"].includes(role)) {
      throw new ApiError("Tu usuario no tiene un rol asignado", 403);
    }
    return {
      id: p.id,
      username: p.email,
      email: p.email,
      role: role === "admin" ? "Admin" : "Barber",
      active: Number(p.active),
      subscriptionExpirationDate: p.subscription_expires_at || undefined,
      barber_id: p.barbers?.[0]?.id || null,
      barber_name: p.barbers?.[0]?.name,
    };
  },
  getUsers: async (): Promise<User[]> => {
    const rows = await result(
      supabase.from("profiles").select("*,user_roles(role),barbers(id,name)")
        .order("created_at").returns<StaffProfile[]>(),
    );
    return rows.map((p) => ({
      id: p.id,
      username: p.email,
      email: p.email,
      role: p.user_roles?.role === "admin" ? "Admin" : "Barber",
      active: Number(p.active),
      subscriptionExpirationDate: p.subscription_expires_at || undefined,
      barber_id: p.barbers?.[0]?.id || null,
      barber_name: p.barbers?.[0]?.name,
      created_at: p.created_at,
    }));
  },
  createUser: (b: Partial<User> & { password: string }) =>
    edge<User>("admin-users", {
      action: "create",
      email: b.username,
      password: b.password,
      role: b.role,
      barber_id: b.barber_id,
    }),
  updateUser: (id: string, b: Partial<User>) =>
    edge<User>("admin-users", {
      action: "update",
      id,
      active: Boolean(b.active),
      barber_id: b.barber_id,
    }),
  updateSubscriptionExpiration: (id: string, date: string) =>
    edge<User>("admin-users", {
      action: "update",
      id,
      subscription_expires_at: date || null,
    }),
  deleteUser: (id: string) =>
    edge<void>("admin-users", { action: "update", id, active: false }),
};
function catalogCrud<T extends Barber | Service>(
  table: "barbers" | "services",
) {
  const payload = (b: Partial<T>) => {
    const allowed = table === "barbers"
      ? ["name", "specialty", "phone", "email", "active"]
      : ["name", "description", "duration", "price", "category", "active"];
    return Object.fromEntries(
      Object.entries(b).filter(([k]) => allowed.includes(k)).map((
        [k, v],
      ) => [k, k === "active" ? Boolean(Number(v)) : v]),
    );
  };
  return {
    getAll: async (): Promise<T[]> => {
      const c = await catalogApi.get();
      return c[table] as T[];
    },
    getAllAdmin: async (): Promise<T[]> => {
      const rows = await result(supabase.from(table).select("*").order("name"));
      return rows.map(active) as T[];
    },
    getById: async (id: string): Promise<T> =>
      active(
        await result(supabase.from(table).select("*").eq("id", id).single()),
      ) as T,
    create: async (b: Partial<T>): Promise<T> => {
      const row = active(
        await result(supabase.from(table).insert(payload(b)).select().single()),
      ) as T;
      notifyCatalogChanged();
      return row;
    },
    update: async (id: string, b: Partial<T>): Promise<T> => {
      const row = active(
        await result(
          supabase.from(table).update(payload(b)).eq("id", id).select()
            .single(),
        ),
      ) as T;
      notifyCatalogChanged();
      return row;
    },
    remove: async (id: string) => {
      await result(supabase.from(table).update({ active: false }).eq("id", id));
      notifyCatalogChanged();
    },
  };
}
export const barbersApi = catalogCrud<Barber>("barbers");
export const servicesApi = {
  ...catalogCrud<Service>("services"),
  saveWithBarbers: async (id: string | null, service: Partial<Service>, barberIds: string[]): Promise<Service> => {
    const saved = await result<Service>(supabase.rpc('admin_save_service', {
      p_id: id,
      p_body: { name: service.name, description: service.description, duration: service.duration, price: service.price, category: service.category, active: Boolean(Number(service.active)) },
      p_barber_ids: barberIds,
    }));
    notifyCatalogChanged();
    return active(saved);
  },
};
export const appointmentsApi = {
  getAll: async (
    params: Record<string, string> = {},
  ): Promise<Appointment[]> => {
    let q = supabase.from("appointments").select("*,barbers(name)").order(
      "starts_at",
    );
    if (params.date) {
      q = q.gte("starts_at", `${params.date}T00:00:00-06:00`).lte(
        "starts_at",
        `${params.date}T23:59:59.999-06:00`,
      );
    }
    if (params.status) q = q.eq("status", params.status);
    if (params.barber_id) q = q.eq("barber_id", params.barber_id);
    return (await result(q)).map(normalizeAppointment);
  },
  getById: async (id: string) =>
    normalizeAppointment(
      await result(
        supabase.from("appointments").select("*,barbers(name)").eq("id", id)
          .single(),
      ),
    ),
  getAvailableSlots: async (
    params: { barber_id: string; date: string; service_id?: string },
  ) => {
    const slots = await edge<Slot[]>("booking", {
      action: "slots",
      ...params,
      barber_id: params.barber_id === "any" ? null : params.barber_id,
    });
    return [...new Set(slots.map((s) => localTime(s.starts_at)))].sort();
  },
  create: (b: Partial<Appointment>) =>
    edge<Appointment>("booking", {
      action: "create",
      appointment: {
        ...b,
        barber_id: b.barber_id === "any" ? null : b.barber_id,
      },
    }),
  update: async (id: string, b: Partial<Appointment>): Promise<Appointment> =>
    result(supabase.rpc("staff_update_appointment", { p_id: id, p_body: b })),
  updateStatus: async (id: string, status: string) => {
    await result(
      supabase.rpc("staff_update_appointment", {
        p_id: id,
        p_body: { status },
      }),
    );
  },
  cancel: async (id: string) => {
    await result(
      supabase.rpc("staff_update_appointment", {
        p_id: id,
        p_body: { status: "cancelled" },
      }),
    );
  },
  getStats: async (): Promise<AppStats> =>
    result(supabase.rpc("appointment_stats")),
};
