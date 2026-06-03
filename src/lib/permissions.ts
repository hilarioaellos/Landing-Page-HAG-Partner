export type Role = "super_admin" | "admin" | "manager" | "partner" | "viewer";

export type Action =
  | "create_org"
  | "invite_user"
  | "change_role"
  | "deactivate_user"
  | "view_users"
  | "edit_profile"
  | "access_modules";

const PERMISSIONS: Record<Role, Action[]> = {
  super_admin: [
    "create_org",
    "invite_user",
    "change_role",
    "deactivate_user",
    "view_users",
    "edit_profile",
    "access_modules",
  ],
  admin: [
    "invite_user",
    "change_role",
    "deactivate_user",
    "view_users",
    "edit_profile",
    "access_modules",
  ],
  manager: ["invite_user", "view_users", "edit_profile", "access_modules"],
  partner: ["edit_profile", "access_modules"],
  viewer: ["access_modules"],
};

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(action) ?? false;
}
