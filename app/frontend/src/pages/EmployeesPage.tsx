import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, getSessionRole } from '../lib/api';
import type { Employee, RoleName } from '../types';

export default function EmployeesPage() {
  const role = getSessionRole();
  const canCreate = role === 'Admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: RoleName; description?: string | null }>>([]);
  const [form, setForm] = useState({ full_name: '', password: '', role_id: 3 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState<string | null>(null);

  async function loadData() {
    const [employeeData, roleData] = await Promise.all([
      apiFetch<Employee[]>('/employees'),
      apiFetch<Array<{ id: number; name: RoleName; description?: string | null }>>('/employees/roles'),
    ]);
    setEmployees(employeeData);
    setRoles(roleData);
    if (roleData.length && form.role_id === 3) {
      setForm((current) => ({ ...current, role_id: roleData[0].id }));
    }
  }

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  async function submitEmployee(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canCreate) {
      setError('Only Admin users can create new employees.');
      return;
    }

    const fullName = form.full_name.trim();
    if (!fullName || !form.password.trim() || !form.role_id) {
      setError('Full name, password, and role are required.');
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

    setConfirmName(fullName);
    setConfirmOpen(true);
  }

  async function confirmRegister() {
    if (!confirmName) {
      setConfirmOpen(false);
      return;
    }

    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({ ...form, full_name: confirmName }),
      });
      setForm({ full_name: '', password: '', role_id: roles[0]?.id ?? 3 });
      await loadData();
      setSuccess('Employee created successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create employee.');
    } finally {
      setConfirmOpen(false);
      setConfirmName(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      {confirmOpen && confirmName ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="panel w-full max-w-md p-6">
            <p className="chip">Confirm registration</p>
            <h4 className="mt-4 text-xl font-semibold text-white">Register new employee?</h4>
            <p className="mt-2 text-sm text-slate-400">Do you want to register {confirmName}?</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button className="btn-secondary" type="button" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={confirmRegister}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <form className="panel p-6" onSubmit={submitEmployee}>
        <p className="chip">Employee Management</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Add employee</h3>
        <div className="mt-6 space-y-4">
          <input className="field" placeholder="Full name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          <input className="field" type="password" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <select className="field" value={form.role_id} onChange={(event) => setForm({ ...form, role_id: Number(event.target.value) })}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={!canCreate}>Register</button>
        </div>
      </form>

      <div className="panel p-6">
        <h3 className="text-2xl font-semibold text-white">Current Employees</h3>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Full name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3">{employee.full_name || employee.username}</td>
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
