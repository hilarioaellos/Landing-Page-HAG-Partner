import { LinearClient } from "@linear/sdk";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const client = new LinearClient({ apiKey: env.LINEAR_API_KEY });
const TEAM_ID = env.LINEAR_TEAM_ID;

// ── Create project ────────────────────────────────────────────────────────────
console.log("Creating project: Landing Page HAG Partner…");
const projectResult = await client.createProject({
  name: "Landing Page HAG Partner",
  teamIds: [TEAM_ID],
  description:
    "Fase 1: Landing page con long scroll + Portal de Partners con autenticación, control de roles y módulo de gestión de usuarios.",
  color: "#3b82f6",
});
const project = await projectResult.project;
console.log(`✓ Project created: ${project.name} [${project.id}]`);

// ── Fetch team states for priority labels ─────────────────────────────────────
const team = await client.team(TEAM_ID);
const statesConn = await team.states();
const states = statesConn.nodes;
const todoState = states.find((s) => s.type === "unstarted");

// ── Issue definitions ─────────────────────────────────────────────────────────
const issues = [
  // Grupo 1 — Landing Page
  {
    title: "L-1: Conectar botón \"Partner Login\" al flujo de auth",
    description:
      "**Archivo:** `src/components/Navbar.tsx`\n\n**Qué hacer:** Cambiar el botón \"Partner Login\" que actualmente abre un modal placeholder para que navegue directamente a `/sign-in`. Reemplazar `open(modal)` por `<Link href=\"/sign-in\">`. Verificar que el texto en `src/messages/en.json` y `es.json` (clave `nav.footer.private`) sea correcto.\n\n**Criterio de aceptación:** Hacer clic en \"Partner Login\" redirige a `/sign-in`. El modal de \"portal en desarrollo\" ya no aparece.",
    priority: 2,
    labelName: "Landing Page",
  },
  {
    title: "L-2: Integrar formulario de contacto con Convex",
    description:
      "**Archivos:** `convex/schema.ts`, `convex/contact.ts`, `src/components/sections/Contact.tsx`\n\n**Qué hacer:**\n1. Agregar tabla `contact_leads` al schema de Convex con campos: `name`, `email`, `message`, `status` (new/contacted/closed).\n2. Crear mutation pública `submitContactForm` en `convex/contact.ts`. Sin auth requerida. Guardar el lead en la tabla.\n3. Reemplazar el mock `setTimeout` en `Contact.tsx` con una llamada a `useMutation(api.contact.submitContactForm)`.\n\n**Criterio de aceptación:** Enviar el formulario guarda un documento en la tabla `contact_leads` de Convex. El estado de la UI cambia de \"idle\" a \"sent\" correctamente.",
    priority: 3,
    labelName: "Landing Page",
  },

  // Grupo 2 — Schema y Guards
  {
    title: "L-3: Actualizar schema: contact_leads + invitations + rol super_admin",
    description:
      "**Archivo:** `convex/schema.ts`\n\n**Qué hacer:**\n1. Agregar tabla `contact_leads`: `{ name, email, message, status: 'new'|'contacted'|'closed' }`.\n2. Agregar tabla `invitations`: `{ orgId, email, role, tokenHash, expiresAt, usedAt?, createdBy }` con índices `by_token_hash` y `by_org`.\n3. Actualizar el union de `profiles.role` para incluir `\"super_admin\"`.\n\n**Nota de seguridad:** `tokenHash` almacena SHA-256 del token; nunca guardar el token plano.\n\n**Criterio de aceptación:** `npx convex dev` sincroniza el schema sin errores. Los tipos generados en `_generated/` reflejan las nuevas tablas.",
    priority: 1,
    labelName: "Backend",
  },
  {
    title: "L-4: Crear guards de autorización en Convex",
    description:
      "**Archivo:** `convex/lib/guards.ts` (nuevo)\n\n**Qué hacer:** Crear cuatro funciones helper que se usan en todas las queries/mutations del portal:\n\n```typescript\nrequireUser(ctx)\n// Verifica sesión activa → lanza ConvexError(\"Unauthenticated\") si no\n\nrequireProfile(ctx, orgId?)\n// Verifica: perfil existe + isActive === true + orgId coincide si se pasa → lanza ConvexError(\"Forbidden\")\n\nrequireRole(ctx, orgId, allowedRoles)\n// Llama requireProfile + verifica que profile.role esté en allowedRoles → lanza ConvexError(\"Forbidden\")\n\nrequireSuper Admin(ctx)\n// Llama requireUser + verifica role === \"super_admin\"\n```\n\n**Criterio de aceptación:** Los guards lanzan errores correctos para usuarios no autenticados, perfiles inactivos, orgId incorrecto y roles insuficientes. Tests manuales desde el dashboard de Convex.",
    priority: 1,
    labelName: "Backend",
  },

  // Grupo 3 — Organizaciones y Perfiles
  {
    title: "L-5: Mutation createOrganization (solo super_admin)",
    description:
      "**Archivo:** `convex/organizations.ts` (nuevo)\n\n**Qué hacer:**\n- `createOrganization({ name, slug, plan })`: usa `requireSuperAdmin`. Crea la org. Retorna el ID.\n- `getOrganization({ orgId })`: usa `requireProfile(ctx, orgId)`. Retorna datos de la org.\n- `listOrganizations()`: usa `requireSuperAdmin`. Lista todas las orgs (para panel HAG).\n\n**Criterio de aceptación:** Solo un usuario con `role=super_admin` puede crear orgs. Intentos de otros roles → 403.",
    priority: 1,
    labelName: "Backend",
  },
  {
    title: "L-6: Inicializar perfil post sign-up vía callback de auth",
    description:
      "**Archivo:** `convex/auth.ts`\n\n**Qué hacer:** Agregar el callback `createOrUpdateUser` a la configuración de `convexAuth`. Lógica:\n1. Al crear usuario nuevo: buscar invitación por email en tabla `invitations` (tokenHash matcheado previamente, no expirada, no usada).\n2. Si existe invitación válida: crear perfil `{ userId, orgId, role, isActive: true, firstName: '', lastName: '' }` y marcar `invitation.usedAt = Date.now()`.\n3. Si no existe invitación: crear perfil con `orgId=null, role='partner', isActive: false` (cuenta en limbo, pendiente de asignación por super_admin).\n\n**Criterio de aceptación:** Sign-up con token válido crea perfil con orgId y rol correcto. Sign-up sin token crea perfil inactivo sin org.",
    priority: 1,
    labelName: "Backend",
  },
  {
    title: "L-7: Mutation updateProfile (perfil propio)",
    description:
      "**Archivo:** `convex/profiles.ts` (nuevo)\n\n**Qué hacer:**\n- `updateProfile({ firstName, lastName, phone, avatar })`: usa `requireProfile`. Solo permite editar campos personales. El usuario NO puede cambiar su propio `role`, `orgId` ni `isActive`.\n- `getMyProfile()`: usa `requireUser`. Retorna perfil del usuario autenticado.\n\n**Criterio de aceptación:** Usuario puede actualizar su nombre y teléfono. Intentar modificar `role` directamente desde el payload → ignorado o rechazado.",
    priority: 2,
    labelName: "Backend",
  },

  // Grupo 4 — Invitaciones
  {
    title: "L-8: Mutation createInvitation (con email vía Resend)",
    description:
      "**Archivo:** `convex/invitations.ts` (nuevo)\n\n**Qué hacer:**\n1. `createInvitation({ orgId, email, role })`: usa `requireRole(ctx, orgId, ['super_admin','admin'])`. \n2. Generar token: 32 bytes aleatorios → `crypto.randomBytes(32).toString('hex')`.\n3. Guardar en DB: `{ orgId, email, role, tokenHash: sha256(token), expiresAt: now + 72h, createdBy: userId }`.\n4. Enviar email con Resend (API key en env `RESEND_API_KEY`). Link: `{SITE_URL}/sign-up?invite={token}`.\n5. Retornar éxito (nunca retornar el token raw al cliente).\n\n**Criterio de aceptación:** Se crea registro en `invitations` con hash. Email llega al destinatario con link válido. Manager/partner/viewer → 403.",
    priority: 1,
    labelName: "Backend",
  },
  {
    title: "L-9: Query verifyInvitation (pública)",
    description:
      "**Archivo:** `convex/invitations.ts`\n\n**Qué hacer:** `verifyInvitation({ token })` — query pública (sin auth):\n1. Calcular `tokenHash = sha256(token)`.\n2. Buscar invitación por `by_token_hash`.\n3. Validar: existe + `expiresAt > now` + `usedAt === undefined`.\n4. Si válida: retornar `{ orgId, email, role }` (nunca el hash).\n5. Si inválida: retornar `null`.\n\n**Usada por:** `/sign-up?invite=TOKEN` para mostrar el formulario prellenado y validar antes de registrar.\n\n**Criterio de aceptación:** Token válido → datos de invitación. Token expirado/usado/inválido → null.",
    priority: 1,
    labelName: "Backend",
  },
  {
    title: "L-10: Mutation revokeInvitation",
    description:
      "**Archivo:** `convex/invitations.ts`\n\n**Qué hacer:** `revokeInvitation({ invitationId })`: usa `requireRole(ctx, orgId, ['super_admin','admin'])`. Verifica que la invitación pertenece a la org del usuario. Si `usedAt` ya existe → error (no se puede revocar una ya usada). Si no usada → eliminar documento.\n\n**Criterio de aceptación:** Admin puede eliminar una invitación pendiente. No puede eliminar invitaciones de otras orgs ni ya usadas.",
    priority: 2,
    labelName: "Backend",
  },
  {
    title: "L-11: Página /sign-up con validación de token de invitación",
    description:
      "**Archivo:** `src/app/sign-up/page.tsx`\n\n**Qué hacer:**\n1. Leer `?invite=TOKEN` de la URL con `useSearchParams()`.\n2. Si no hay token → redirect inmediato a `/sign-in?error=invite_required`.\n3. Si hay token → llamar `useQuery(api.invitations.verifyInvitation, { token })`. Mientras carga → spinner.\n4. Si la query retorna null → mostrar error \"Invitación inválida o expirada\" + link a `/sign-in`.\n5. Si válida → mostrar formulario con email prellenado (no editable) y campo de contraseña.\n6. Al submit → `signIn('password', { flow: 'signUp', email, password })`. El callback de auth (`L-6`) completa el perfil.\n\n**Criterio de aceptación:** Sin token → no se puede acceder a sign-up. Con token expirado → error claro. Con token válido → registro exitoso crea perfil con orgId y rol correctos.",
    priority: 1,
    labelName: "Auth",
  },

  // Grupo 5 — Portal Layout
  {
    title: "L-12: Layout del portal privado (sidebar + header)",
    description:
      "**Archivos:** `src/app/private/layout.tsx`, `src/components/portal/Sidebar.tsx`, `src/components/portal/Header.tsx`\n\n**Qué hacer:**\n- `layout.tsx`: layout de dos columnas (sidebar fijo + área de contenido).\n- `Sidebar.tsx`: lista todos los módulos definidos. Los construidos en Fase 1: `Usuarios`, `Perfil`. Los futuros: `Finanzas`, `Contabilidad`, `Proveedores`, `Documentos`, `Mensajería`, `CRM` → se muestran con badge `Próximamente` y sin link activo.\n- `Header.tsx`: nombre del usuario (de `useQuery(api.users.currentUser)`), avatar placeholder, botón de logout (`useAuthActions().signOut()`).\n\n**Criterio de aceptación:** Navegar a `/private/*` muestra el layout. El sidebar es consistente entre páginas. El botón de logout redirige a `/sign-in`.",
    priority: 2,
    labelName: "Portal",
  },
  {
    title: "L-13: PermissionGate y mapa de permisos (frontend)",
    description:
      "**Archivos:** `src/lib/permissions.ts`, `src/components/portal/PermissionGate.tsx`\n\n**Qué hacer:**\n`permissions.ts` — define el mapa de rol → acciones permitidas:\n```typescript\nconst PERMISSIONS = {\n  super_admin: ['create_org','invite_user','change_role','deactivate_user','view_users','edit_profile','access_modules'],\n  admin: ['invite_user','change_role','deactivate_user','view_users','edit_profile','access_modules'],\n  manager: ['invite_user','view_users','edit_profile','access_modules'],\n  partner: ['edit_profile','access_modules'],\n  viewer: ['access_modules'],\n};\nexport function can(role, action): boolean\n```\n\n`PermissionGate.tsx` — wrapper React:\n```tsx\n<PermissionGate action=\"change_role\" fallback={null}>\n  <button>Cambiar rol</button>\n</PermissionGate>\n```\n\n**Importante:** Este archivo es solo para UI. Los permisos reales están en los guards de Convex.\n\n**Criterio de aceptación:** Un viewer no ve el botón de \"Cambiar rol\". Un admin sí lo ve.",
    priority: 2,
    labelName: "Portal",
  },
  {
    title: "L-14: Dashboard overview del portal",
    description:
      "**Archivo:** `src/app/private/page.tsx`\n\n**Qué hacer:** Reemplazar el placeholder \"Coming Soon\" con una página real:\n- Saludo personalizado: \"Bienvenido, {firstName}\" (de `currentUser`).\n- Nombre de la organización.\n- Grid de accesos rápidos a módulos activos según rol (usando `can()` de `permissions.ts`).\n- Los módulos no disponibles muestran una tarjeta con badge \"Próximamente\" (mismos que el sidebar).\n- Estado de la cuenta: rol del usuario, fecha de último acceso (si disponible).\n\n**Criterio de aceptación:** Un admin ve todos los módulos activos. Un viewer solo ve los módulos de lectura. La página usa datos reales de Convex (no mocks).",
    priority: 2,
    labelName: "Portal",
  },

  // Grupo 6 — Módulo de Usuarios
  {
    title: "L-15: Vista lista de usuarios de la organización",
    description:
      "**Archivos:** `src/app/private/users/page.tsx`, `convex/profiles.ts`\n\n**Qué hacer:**\n- Query `getOrgUsers({ orgId })` en `convex/profiles.ts`: usa `requireRole(ctx, orgId, ['super_admin','admin','manager'])`. Retorna lista de perfiles de la org.\n- Página `private/users/page.tsx`: tabla con columnas: Nombre, Email, Rol, Estado (activo/inactivo). Si el usuario no tiene permiso → mostrar 403 o redirigir.\n\n**Criterio de aceptación:** Admin ve todos los usuarios de su org. Manager también los ve. Partner y viewer → acceso denegado desde backend.",
    priority: 2,
    labelName: "Users",
  },
  {
    title: "L-16: Mutation updateUserRole (con protección de último admin)",
    description:
      "**Archivo:** `convex/profiles.ts`\n\n**Qué hacer:** `updateUserRole({ profileId, newRole })`:\n1. Usa `requireRole(ctx, orgId, ['super_admin','admin'])`.\n2. Cargar perfil objetivo. Verificar que pertenece a la misma org.\n3. Si el usuario intenta cambiar su propio rol a algo menor y es el ÚLTIMO admin/super_admin de la org → lanzar error `\"Cannot remove the last admin\"`.\n4. No permitir asignar un rol superior al propio (admin no puede promover a super_admin).\n5. Actualizar `profile.role`.\n\n**Criterio de aceptación:** Todos los casos borde protegidos: último admin, auto-demotion, cross-org, rol superior.",
    priority: 1,
    labelName: "Users",
  },
  {
    title: "L-17: Mutation setUserActive (bloqueo real de acceso)",
    description:
      "**Archivo:** `convex/profiles.ts`\n\n**Qué hacer:** `setUserActive({ profileId, isActive })`:\n1. Usa `requireRole(ctx, orgId, ['super_admin','admin'])`.\n2. Verificar que el perfil pertenece a la misma org.\n3. No permitir desactivarse a uno mismo.\n4. Si desactivando al último admin → lanzar error.\n5. Actualizar `profile.isActive`.\n\n**El guard `requireProfile` ya verifica `isActive === true` en cada operación.** Por tanto, un usuario desactivado queda bloqueado en backend automáticamente, no solo en UI.\n\n**Criterio de aceptación:** Desactivar usuario → ese usuario no puede llamar ninguna mutation/query protegida. Reactivar → acceso restaurado.",
    priority: 1,
    labelName: "Users",
  },
  {
    title: "L-18: Flujo de invitación desde la UI del portal",
    description:
      "**Archivo:** `src/app/private/users/page.tsx`\n\n**Qué hacer:** Agregar a la página de usuarios:\n1. Botón \"Invitar usuario\" (visible solo para admin/super_admin con `PermissionGate`).\n2. Modal/formulario: campos email + selector de rol (admin/manager/partner/viewer). Submit → `useMutation(api.invitations.createInvitation)`.\n3. Sección \"Invitaciones pendientes\": query `listInvitations({ orgId })` → tabla con email, rol, fecha de expiración. Botón \"Revocar\" por fila → `useMutation(api.invitations.revokeInvitation)`.\n\n**Criterio de aceptación:** Admin puede invitar y revocar. Invitaciones pendientes se muestran en tiempo real (Convex reactive). Manager puede invitar pero no cambiar roles.",
    priority: 2,
    labelName: "Users",
  },
  {
    title: "L-19: Página de perfil propio del usuario",
    description:
      "**Archivo:** `src/app/private/profile/page.tsx`\n\n**Qué hacer:**\n- Carga datos del usuario con `useQuery(api.users.currentUser)`.\n- Formulario editable: First name, Last name, Phone.\n- Avatar: placeholder con iniciales (imagen real en fase posterior).\n- Campos de solo lectura: Email, Organización, Rol.\n- Submit → `useMutation(api.profiles.updateProfile)`.\n- Feedback visual de guardado exitoso.\n\n**Criterio de aceptación:** Usuario actualiza su nombre → cambio se refleja en el header del portal. Intentar modificar el rol desde el payload es ignorado por el backend.",
    priority: 3,
    labelName: "Users",
  },
];

// ── Create labels (if not exist) ──────────────────────────────────────────────
const labelsConn = await team.labels();
const existingLabels = labelsConn.nodes;
const labelMap = {};
for (const label of existingLabels) {
  labelMap[label.name] = label.id;
}

const labelDefs = [
  { name: "Landing Page", color: "#10b981" },
  { name: "Backend",      color: "#6366f1" },
  { name: "Auth",         color: "#f59e0b" },
  { name: "Portal",       color: "#3b82f6" },
  { name: "Users",        color: "#ec4899" },
];

for (const def of labelDefs) {
  if (!labelMap[def.name]) {
    const res = await client.createIssueLabel({ teamId: TEAM_ID, name: def.name, color: def.color });
    const label = await res.issueLabel;
    labelMap[def.name] = label.id;
    console.log(`  + Label: ${def.name}`);
  }
}

// ── Create issues ─────────────────────────────────────────────────────────────
console.log(`\nCreating ${issues.length} issues…`);
for (const issue of issues) {
  const labelId = labelMap[issue.labelName];
  await client.createIssue({
    teamId: TEAM_ID,
    projectId: project.id,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    stateId: todoState?.id,
    labelIds: labelId ? [labelId] : [],
  });
  console.log(`  ✓ ${issue.title.split(":")[0]}`);
}

console.log(`\n✅ Done! Project and ${issues.length} issues created in Linear.`);
console.log(`   View at: https://linear.app/hilario-aellos/project/${project.id}`);
