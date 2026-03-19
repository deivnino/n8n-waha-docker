export interface DaySchedule {
  enabled: boolean;
  open: string;   // "09:00"
  close: string;  // "18:00"
}

export interface BusinessHours {
  timezone: string;
  schedule: Record<string, DaySchedule>;
  outside_message: string;
}

export interface ClientSettings {
  phone_number: string;
  client_name: string;
  business_name: string;
  website_url: string;
  status: "AUTO" | "MANUAL" | "PAUSED";
  is_vip: boolean;
  outside_hours_enabled: boolean;
  business_hours: BusinessHours;
  allegra_url: string | null;
  allegra_api_key: string | null;
}

export const DAYS = [
  { key: "monday",    label: "Lunes"     },
  { key: "tuesday",   label: "Martes"    },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday",  label: "Jueves"    },
  { key: "friday",    label: "Viernes"   },
  { key: "saturday",  label: "Sábado"    },
  { key: "sunday",    label: "Domingo"   },
];
