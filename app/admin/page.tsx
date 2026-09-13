import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/server';
import { RequestError } from '@/lib/admin/validation';
import AdminDashboard from '@/components/admin/AdminDashboard';
export default async function AdminPage() {
 try { await requireAdmin(); }
 catch(e) { if(e instanceof RequestError && e.status===401)redirect('/login');if(e instanceof RequestError && e.status===403)redirect('/account');throw e; }
 return <AdminDashboard />;
}
