"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { can, type Action, type Role } from "@/lib/permissions";

interface Props {
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({ action, children, fallback = null }: Props) {
  const me = useQuery(api.users.currentUser);
  const role = me?.profile?.role as Role | undefined;

  if (me === undefined) return null;
  if (!can(role, action)) return <>{fallback}</>;
  return <>{children}</>;
}
