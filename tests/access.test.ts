import { beforeAll, describe, expect, it } from "vitest";
import { GET as listPatients } from "@/app/api/patients/route";
import { GET as listExpenses } from "@/app/api/expenses/route";
import { GET as listRoles, POST as createRole } from "@/app/api/roles/route";
import { DELETE as deleteRole, PATCH as updateRole } from "@/app/api/roles/[id]/route";
import { GET as listUsers, POST as createUser } from "@/app/api/users/route";
import { PATCH as updateUser } from "@/app/api/users/[id]/route";
import { POST as resetPassword } from "@/app/api/users/[id]/password/route";
import { prisma } from "@/lib/prisma";
import { ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLES, can, defaultRoleHasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { call, createSession, signIn, TEST_PASSWORD, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;

const roles = (cookie = admin.cookie) => call(listRoles, "/api/roles", { cookie });
const roleByKey = async (key: string) => (await roles()).json.roles.find((role: { key: string }) => role.key === key);
const addUser = (body: Record<string, unknown>, cookie = admin.cookie) => call(createUser, "/api/users", { method: "POST", cookie, body });
const edit = (id: string, body: Record<string, unknown>, cookie = admin.cookie) =>
  call(updateUser, `/api/users/${id}`, { method: "PATCH", cookie, params: { id }, body });
const editRole = (id: string, body: Record<string, unknown>, cookie = admin.cookie) =>
  call(updateRole, `/api/roles/${id}`, { method: "PATCH", cookie, params: { id }, body });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("permission catalogue", () => {
  it("only the administrator holds access-control permissions by default", () => {
    for (const role of DEFAULT_ROLES.filter((entry) => entry.key !== "admin")) {
      for (const permission of ADMIN_ONLY_PERMISSIONS) expect(role.permissions, role.key).not.toContain(permission);
    }
    expect(DEFAULT_ROLES.find((role) => role.key === "admin")?.permissions).toEqual(ALL_PERMISSIONS);
  });

  it("gives the built-in roles sensible defaults", () => {
    expect(defaultRoleHasPermission("doctor", "prescriptions:write")).toBe(true);
    expect(defaultRoleHasPermission("doctor", "billing:refund")).toBe(false);
    expect(defaultRoleHasPermission("accountant", "finance:close")).toBe(true);
    expect(defaultRoleHasPermission("accountant", "clinical:write")).toBe(false);
    expect(defaultRoleHasPermission("assistant", "inventory:write")).toBe(true);
    expect(can(["a:b"], "dashboard:read")).toBe(false);
  });
});

describe("access to the access screens", () => {
  it("is for administrators only", async () => {
    expect((await call(listUsers, "/api/users")).status).toBe(401);
    expect((await call(listUsers, "/api/users", { cookie: receptionist.cookie })).status).toBe(403);
    expect((await roles(receptionist.cookie)).status).toBe(403);
    expect((await addUser({ name: "Nope", email: "nope@example.test", phone: "01712345678", role: "receptionist", password: "long-enough-password" }, receptionist.cookie)).status).toBe(403);
    expect((await call(createRole, "/api/roles", { method: "POST", cookie: receptionist.cookie, body: { name: "Sneaky", permissions: [] } })).status).toBe(403);
  });
});

describe("roles", () => {
  it("lists the built-in roles, with the administrator locked", async () => {
    const response = await roles();
    expect(response.status).toBe(200);
    const keys = response.json.roles.map((role: { key: string }) => role.key);
    expect(keys).toEqual(expect.arrayContaining(["admin", "receptionist", "doctor", "assistant", "accountant"]));
    expect((await roleByKey("admin")).locked).toBe(true);
    expect((await editRole((await roleByKey("admin")).id, { permissions: [] })).status).toBe(409);
  });

  it("creates a custom role, validates permissions, and refuses admin-only ones", async () => {
    expect((await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Bad", permissions: ["made:up"] } })).status).toBe(400);
    const escalation = await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Escalator", permissions: ["users:manage"] } });
    expect(escalation.status).toBe(400);
    expect(escalation.json.error).toMatch(/administrator/i);
    expect((await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Admin", permissions: [] } })).status).toBe(400);

    const created = await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Lab technician", description: "Lab work", permissions: ["dashboard:read", "patients:read"] } });
    expect(created.status).toBe(201);
    expect(created.json.role.key).toBe("lab-technician");
    expect((await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Lab technician", permissions: [] } })).status).toBe(409);
  });

  it("applies a permission change to people already signed in", async () => {
    const receptionistRole = await roleByKey("receptionist");
    expect((await call(listPatients, "/api/patients", { cookie: receptionist.cookie })).status).toBe(200);
    // Take patient access away: the same session is refused straight away.
    const without = receptionistRole.permissions.filter((permission: string) => !permission.startsWith("patients:"));
    expect((await editRole(receptionistRole.id, { permissions: without })).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie: receptionist.cookie })).status).toBe(403);
    // And give it back.
    expect((await editRole(receptionistRole.id, { permissions: receptionistRole.permissions })).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie: receptionist.cookie })).status).toBe(200);
  });

  it("only deletes custom roles that nobody uses", async () => {
    expect((await call(deleteRole, "/api/roles/x", { method: "DELETE", cookie: admin.cookie, params: { id: "x" } })).status).toBe(404);
    const doctor = await roleByKey("doctor");
    expect((await call(deleteRole, `/api/roles/${doctor.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: doctor.id } })).status).toBe(409);

    const temp = await call(createRole, "/api/roles", { method: "POST", cookie: admin.cookie, body: { name: "Temporary", permissions: ["dashboard:read"] } });
    const member = await addUser({ name: "Temp Member", email: "temp.member@example.test", phone: "01712345678", role: "temporary", password: "long-enough-password" });
    expect(member.status).toBe(201);
    const blocked = await call(deleteRole, `/api/roles/${temp.json.role.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: temp.json.role.id } });
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toMatch(/1 staff account/);
    expect((await edit(member.json.user.id, { role: "receptionist" })).status).toBe(200);
    expect((await call(deleteRole, `/api/roles/${temp.json.role.id}`, { method: "DELETE", cookie: admin.cookie, params: { id: temp.json.role.id } })).status).toBe(200);
  });
});

describe("staff accounts", () => {
  it("creates an account that can sign in and uses its role's permissions", async () => {
    const created = await addUser({ name: "Dr Accounts", email: "Accounts.Person@Example.test", phone: "01712345678", role: "accountant", password: TEST_PASSWORD });
    expect(created.status).toBe(201);
    expect(created.json.user.email).toBe("accounts.person@example.test");
    expect(created.json.user.role).toBe("accountant");

    const cookie = await signIn("accounts.person@example.test");
    expect((await call(listExpenses, "/api/expenses", { cookie })).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie })).status).toBe(200);
    expect((await call(listUsers, "/api/users", { cookie })).status).toBe(403);
  });

  it("validates new accounts", async () => {
    expect((await addUser({ name: "A", email: "bad", phone: "01712345678", role: "doctor", password: "long-enough-password" })).status).toBe(400);
    expect((await addUser({ name: "Short Pass", email: "short@example.test", phone: "01712345678", role: "doctor", password: "short" })).status).toBe(400);
    expect((await addUser({ name: "No Role", email: "norole@example.test", phone: "01712345678", role: "ghost", password: "long-enough-password" })).status).toBe(400);
    expect((await addUser({ name: "No Access", email: "noaccess@example.test", phone: "01712345678", role: "user", password: "long-enough-password" })).status).toBe(400);
    expect((await addUser({ name: "Duplicate", email: "accounts.person@example.test", phone: "01712345678", role: "doctor", password: "long-enough-password" })).status).toBe(409);
  });

  it("deactivating blocks every session and every sign-in; reactivating restores it", async () => {
    const created = await addUser({ name: "Leaver", email: "leaver@example.test", phone: "01712345678", role: "receptionist", password: TEST_PASSWORD });
    const id = created.json.user.id as string;
    const cookie = await signIn("leaver@example.test");
    expect((await call(listPatients, "/api/patients", { cookie })).status).toBe(200);

    expect((await edit(id, { isActive: false })).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie })).status).toBe(401);
    await expect(auth.api.signInEmail({ body: { email: "leaver@example.test", password: TEST_PASSWORD } })).rejects.toThrow();

    expect((await edit(id, { isActive: true })).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie: await signIn("leaver@example.test") })).status).toBe(200);
  });

  it("changes a role, and the next request already follows it", async () => {
    const created = await addUser({ name: "Moves Role", email: "moves@example.test", phone: "01712345678", role: "receptionist", password: TEST_PASSWORD });
    const id = created.json.user.id as string;
    const cookie = await signIn("moves@example.test");
    expect((await call(listExpenses, "/api/expenses", { cookie })).status).toBe(403);
    expect((await edit(id, { role: "accountant" })).status).toBe(200);
    expect((await call(listExpenses, "/api/expenses", { cookie })).status).toBe(200);
  });

  it("keeps the last administrator and protects the caller from locking themselves out", async () => {
    // The test database may hold other admins from other test files; make this the only one.
    await prisma.user.updateMany({ where: { role: "admin", id: { not: admin.id } }, data: { role: "receptionist" } });
    expect((await edit(admin.id, { isActive: false })).status).toBe(409);
    expect((await edit(admin.id, { role: "receptionist" })).status).toBe(409);

    const second = await addUser({ name: "Second Admin", email: "second.admin@example.test", phone: "01712345678", role: "admin", password: TEST_PASSWORD });
    expect(second.status).toBe(201);
    // Now the original can be demoted by the other administrator, but never to zero admins.
    const otherCookie = await signIn("second.admin@example.test");
    expect((await edit(admin.id, { role: "receptionist" }, otherCookie)).status).toBe(200);
    expect((await edit(second.json.user.id, { isActive: false }, otherCookie)).status).toBe(409);
    await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
  });

  it("resets another person's password and signs them out", async () => {
    const created = await addUser({ name: "Forgetful", email: "forgetful@example.test", phone: "01712345678", role: "receptionist", password: TEST_PASSWORD });
    const id = created.json.user.id as string;
    const cookie = await signIn("forgetful@example.test");
    const reset = (target: string, password: string) => call(resetPassword, `/api/users/${target}/password`, { method: "POST", cookie: admin.cookie, params: { id: target }, body: { password } });
    expect((await reset(id, "short")).status).toBe(400);
    expect((await reset(admin.id, "another-long-password")).status).toBe(400);
    expect((await reset(id, "brand-new-password-1")).status).toBe(200);
    expect((await call(listPatients, "/api/patients", { cookie })).status).toBe(401);
    await expect(auth.api.signInEmail({ body: { email: "forgetful@example.test", password: TEST_PASSWORD } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: "forgetful@example.test", password: "brand-new-password-1" } })).resolves.toBeTruthy();
  });

  it("stores a mobile number, validates it, and lets e-mail and number be edited", async () => {
    const created = await addUser({ name: "Contact Person", email: "contact.person@example.test", phone: "0171 234-5678", role: "doctor", password: TEST_PASSWORD });
    expect(created.status).toBe(201);
    expect(created.json.user.phone).toBe("01712345678");
    const id = created.json.user.id as string;

    expect((await addUser({ name: "No Phone", email: "nophone@example.test", role: "doctor", password: TEST_PASSWORD })).status).toBe(400);
    const badPhone = await addUser({ name: "Bad Phone", email: "badphone@example.test", phone: "12345", role: "doctor", password: TEST_PASSWORD });
    expect(badPhone.status).toBe(400);
    expect((await edit(id, { phone: "abc" })).status).toBe(400);

    expect((await edit(id, { phone: "01987654321", email: "Renamed.Person@Example.test" })).json.user).toMatchObject({ phone: "01987654321", email: "renamed.person@example.test" });
    // The new e-mail is the sign-in; the old one no longer works.
    expect(await signIn("renamed.person@example.test")).toBeTruthy();
    await expect(auth.api.signInEmail({ body: { email: "contact.person@example.test", password: TEST_PASSWORD } })).rejects.toThrow();
    // An e-mail already in use is refused; an empty number clears it.
    expect((await edit(id, { email: "accounts.person@example.test" })).status).toBe(409);
    expect((await edit(id, { phone: "" })).json.user.phone).toBeNull();
    expect((await edit(id, { email: "not-an-email" })).status).toBe(400);
  });

  it("lists accounts with their role names", async () => {
    const response = await call(listUsers, "/api/users", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    expect(response.json.currentUserId).toBe(admin.id);
    const found = response.json.users.find((user: { email: string }) => user.email === "accounts.person@example.test");
    expect(found.roleName).toBe("Accountant");
    expect(response.json.roles.length).toBeGreaterThanOrEqual(5);
  });
});
