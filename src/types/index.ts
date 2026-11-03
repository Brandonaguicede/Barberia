export interface Barber {
  id: string;
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  category: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  barber_id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  starts_at?: string;
  ends_at?: string;
  access_token?: string;
  shop_name?: string;
  can_cancel?: boolean;
  can_reschedule?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  barber_name?: string;
  service_name?: string;
  service_duration?: number;
  service_price?: number;
}

export interface AppStats {
  upcoming: number;
  today: number;
  pending: number;
  monthlyRevenue: number;
}

export interface User {
  id: string;
  username: string;
  role: 'Admin' | 'Barber';
  email?: string;
  isActive?: boolean;
  subscriptionExpirationDate?: string;
  barber_id: string | null;
  barber_name?: string | null;
  active?: number;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
