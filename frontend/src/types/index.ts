export interface Room {
  room_id: string;
  name: string;
  capacity: number;
  building_name: string;
  floor_name: string;
}

export interface Birthday {
  id: string;
  name: string;
  receiveId: string;
  receiveIdType: string;
  month: number;
  day: number;
  message?: string;
}

export interface SyncResult {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ event: string; error: string }>;
}

export interface LarkUser {
  user_id: string;
  open_id: string;
  union_id: string;
  name?: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  employee_no?: string;
  employee_type?: number;
  job_title?: string;
  city?: string;
  status?: {
    is_active: boolean;
    is_frozen: boolean;
    is_resigned: boolean;
  };
  avatar?: {
    avatar_72: string;
  };
}
