import { useEffect, useState, type FormEvent } from 'react';
<<<<<<< HEAD
import { apiFetch, getSessionRole } from '../lib/api';
import type { Employee, RoleName } from '../types';

export default function EmployeesPage() {
  const role = getSessionRole();
  const canCreate = role === 'Admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: RoleName; description?: string | null }>>([]);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role_id: 3 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
=======
import { apiFetch } from '../lib/api';
import type { Employee, RoleName } from '../types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: RoleName; description?: string | null }>>([]);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role_id: 3 });
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9

  async function loadData() {
    const [employeeData, roleData] = await Promise.all([
      apiFetch<Employee[]>('/employees'),
      apiFetch<Array<{ id: number; name: RoleName; description?: string | null }>>('/employees/roles'),
    ]);
    setEmployees(employeeData);
    setRoles(roleData);
<<<<<<< HEAD
    if (roleData.length && form.role_id === 3) {
      setForm((current) => ({ ...current, role_id: roleData[0].id }));
    }
=======
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9
  }

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  async function submitEmployee(event: FormEvent) {
    event.preventDefault();
<<<<<<< HEAD
    setError(null);
    setSuccess(null);

    if (!canCreate) {
      setError('Only Admin users can create new employees.');
      return;
    }

    if (!form.username.trim() || !form.password.trim() || !form.role_id) {
      setError('Username, password, and role are required.');
      return;
    }
    if (form.password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!roles.length) {
      setError('Roles are not available. Please refresh and try again.');
      return;
    }

    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({ ...form, full_name: form.full_name || null }),
      });
      setForm({ username: '', full_name: '', password: '', role_id: roles[0]?.id ?? 3 });
      await loadData();
      setSuccess('Employee created successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create employee.');
    }
=======
    await apiFetch('/employees', {
      method: 'POST',
      body: JSON.stringify({ ...form, full_name: form.full_name || null }),
    });
    setForm({ username: '', full_name: '', password: '', role_id: roles[0]?.id ?? 3 });
    await loadData();
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form className="panel p-6" onSubmit={submitEmployee}>
        <p className="chip">Employee Management</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Add employee</h3>
        <div className="mt-6 space-y-4">
          <input className="field" placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <input className="field" placeholder="Full name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          <input className="field" type="password" placeholder="Temporary password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <select className="field" value={form.role_id} onChange={(event) => setForm({ ...form, role_id: Number(event.target.value) })}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
<<<<<<< HEAD
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={!canCreate}>Create employee</button>
=======
          <button className="btn-primary w-full" type="submit">Create employee</button>
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9
        </div>
      </form>

      <div className="panel p-6">
        <h3 className="text-2xl font-semibold text-white">Current team</h3>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3">{employee.username}</td>
                  <td className="px-4 py-3">{employee.role.name}</td>
                  <td className="px-4 py-3">{employee.is_active ? 'Active' : 'Disabled'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
