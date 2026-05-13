import larkClient from "./client";

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
  status?: {
    is_active: boolean;
    is_frozen: boolean;
    is_resigned: boolean;
  };
  department_ids?: string[];
  job_title?: string;
  city?: string;
  country?: string;
  avatar?: {
    avatar_72: string;
    avatar_240: string;
    avatar_640: string;
    avatar_origin: string;
  };
}

interface AuthorizedScopes {
  departmentIds: string[];
  userIds: string[];
}

async function getAuthorizedScopes(): Promise<AuthorizedScopes> {
  const departmentIds: string[] = [];
  const userIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await larkClient.get("/contact/v3/scopes", {
      params: {
        user_id_type: "user_id",
        department_id_type: "department_id",
        page_size: 50,
        ...(pageToken ? { page_token: pageToken } : {}),
      },
    });
    const data = res.data.data ?? {};
    for (const dept of data.authorized_departments ?? []) {
      departmentIds.push(dept.department_id as string);
    }
    for (const uid of data.user_ids ?? []) {
      userIds.push(uid as string);
    }
    pageToken = data.page_token;
  } while (pageToken);

  return { departmentIds, userIds };
}

async function listUsersInDepartment(departmentId: string): Promise<LarkUser[]> {
  const users: LarkUser[] = [];
  let pageToken: string | undefined;

  do {
    const res = await larkClient.get("/contact/v3/users", {
      params: {
        page_size: 50,
        user_id_type: "user_id",
        department_id_type: "department_id",
        department_id: departmentId,
        ...(pageToken ? { page_token: pageToken } : {}),
      },
    });
    const data = res.data.data ?? {};
    for (const user of data.items ?? []) {
      users.push(user as LarkUser);
    }
    pageToken = data.page_token;
  } while (pageToken);

  return users;
}

async function getUserById(userId: string): Promise<LarkUser | null> {
  try {
    const res = await larkClient.get(`/contact/v3/users/${userId}`, {
      params: { user_id_type: "user_id" },
    });
    return (res.data.data?.user ?? null) as LarkUser | null;
  } catch {
    return null;
  }
}

export async function listUsers(): Promise<LarkUser[]> {
  const { departmentIds, userIds } = await getAuthorizedScopes();

  const seen = new Set<string>();
  const users: LarkUser[] = [];

  for (const deptId of departmentIds) {
    const deptUsers = await listUsersInDepartment(deptId);
    for (const user of deptUsers) {
      if (!seen.has(user.user_id)) {
        seen.add(user.user_id);
        users.push(user);
      }
    }
  }

  for (const uid of userIds) {
    if (!seen.has(uid)) {
      seen.add(uid);
      const user = await getUserById(uid);
      if (user) users.push(user);
    }
  }

  return users;
}
