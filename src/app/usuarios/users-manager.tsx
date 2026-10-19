"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import type { PanelRole } from "@/lib/auth/viewer";

import type { CustomerType } from "../dashboard/types";
import { createPanelUser, deletePanelUser, resetPanelUserPassword, updatePanelUserAccess } from "./actions";

export type PanelUserRow = { userId: string; email: string; role: PanelRole; customerType: CustomerType | null };

// Un solo selector combina rol y segmento: el operador siempre tiene uno asignado.
type Access = "admin" | "operator:wholesale" | "operator:retail";
const accessLabels: Record<Access, string> = {
  admin: "Administrador (ve todo)",
  "operator:wholesale": "Operador · Mayoristas",
  "operator:retail": "Operador · Minoristas",
};

function toAccess(role: PanelRole, customerType: CustomerType | null): Access {
  return role === "admin" ? "admin" : `operator:${customerType ?? "wholesale"}`;
}

function fromAccess(access: Access): { role: PanelRole; customerType: CustomerType | null } {
  return access === "admin" ? { role: "admin", customerType: null } : { role: "operator", customerType: access.split(":")[1] as CustomerType };
}

function AccessSelect({ value, onChange, disabled, label }: { value: Access; onChange: (value: Access) => void; disabled?: boolean; label: string }) {
  return (
    <select aria-label={label} disabled={disabled} onChange={(event) => onChange(event.target.value as Access)} value={value}>
      {(Object.keys(accessLabels) as Access[]).map((access) => <option key={access} value={access}>{accessLabels[access]}</option>)}
    </select>
  );
}

export function UsersManager({ users, currentUserId }: { users: PanelUserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; message: string }>();
  const [access, setAccess] = useState<Access>("operator:wholesale");

  const run = (task: () => Promise<{ ok: boolean; message: string }>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await task();
      setNotice(result);
      if (result.ok) onSuccess?.();
    });
  };

  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () => createPanelUser({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), ...fromAccess(access) }),
      () => form.reset(),
    );
  };

  const changePassword = (user: PanelUserRow) => {
    const password = window.prompt(`Nueva contraseña para ${user.email} (mínimo 8 caracteres):`);
    if (password) run(() => resetPanelUserPassword(user.userId, password));
  };

  const removeUser = (user: PanelUserRow) => {
    if (window.confirm(`¿Eliminar a ${user.email}? Ya no podrá ingresar al panel.`)) run(() => deletePanelUser(user.userId));
  };

  return (
    <>
      <section className="users-panel">
        <h2>Nuevo usuario</h2>
        <form className="users-form" onSubmit={createUser}>
          <label><span>Correo</span><input autoComplete="off" name="email" required type="email" /></label>
          <label><span>Contraseña</span><input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
          <label><span>Acceso</span><AccessSelect label="Acceso del nuevo usuario" onChange={setAccess} value={access} /></label>
          <button className="auth-submit" disabled={pending} type="submit">Crear usuario</button>
        </form>
        {notice && <p className={notice.ok ? "users-notice" : "users-notice is-error"} role="status">{notice.message}</p>}
      </section>

      <section className="users-panel">
        <h2>Usuarios ({users.length})</h2>
        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>Correo</th><th>Acceso</th><th>Acciones</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.userId === currentUserId;
                return (
                  <tr key={user.userId}>
                    <td>{user.email}{isSelf && " (tú)"}</td>
                    <td>
                      <AccessSelect
                        disabled={pending || isSelf}
                        label={`Acceso de ${user.email}`}
                        onChange={(value) => { const next = fromAccess(value); run(() => updatePanelUserAccess(user.userId, next.role, next.customerType)); }}
                        value={toAccess(user.role, user.customerType)}
                      />
                    </td>
                    <td>
                      <div className="users-row-actions">
                        <button disabled={pending} onClick={() => changePassword(user)} type="button">Cambiar contraseña</button>
                        <button className="is-danger" disabled={pending || isSelf} onClick={() => removeUser(user)} type="button">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
