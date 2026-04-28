import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/api';
import type { Employee, RoleName } from '../types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: RoleName; description?: string | null }>>([]);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role_id: 3 });

  async function loadData() {
    const [employeeData, roleData] = await Promise.all([
      apiFetch<Employee[]>('/employees'),
      apiFetch<Array<{ id: number; name: RoleName; description?: string | null }>>('/employees/roles'),
    ]);
    setEmployees(employeeData);
    setRoles(roleData);
  }

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  async function submitEmployee(event: FormEvent) {
    event.preventDefault();
    await apiFetch('/employees', {
      method: 'POST',
      body: JSON.stringify({ ...form, full_name: form.full_name || null }),
    });
    setForm({ username: '', full_name: '', password: '', role_id: roles[0]?.id ?? 3 });
    await loadData();
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
          <button className="btn-primary w-full" type="submit">Create employee</button>
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
