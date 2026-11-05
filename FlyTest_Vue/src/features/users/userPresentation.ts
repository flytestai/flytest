import type { User } from '@/services/userService';
export type UserTab = 'all' | 'pending' | 'approved' | 'rejected' | 'disabled';
export interface UserFilters { query: string; organization: string; role: string; account: string; approval: string }
export function approvalOf(user: User): string {
  return ['pending','approved','rejected'].includes(user.approval_status || '') ? user.approval_status! : 'unknown';
}
export function userOverview(users: User[]) {
  return { all:users.length, pending:users.filter(user=>approvalOf(user)==='pending').length, approved:users.filter(user=>approvalOf(user)==='approved').length, rejected:users.filter(user=>approvalOf(user)==='rejected').length, disabled:users.filter(user=>!user.is_active).length, active:users.filter(user=>user.is_active).length, administrators:users.filter(user=>user.is_staff).length };
}
export function userOrganizations(user: User) { return (user.groups || []).filter((group): group is string => typeof group === 'string' && !!group.trim()); }
export function filterUsers(users: User[], filters: UserFilters, tab: UserTab) {
  const query=filters.query.trim().toLowerCase();
  return users.filter(user => (tab==='all' || (tab==='disabled' ? !user.is_active : approvalOf(user)===tab))
    && (!query || [user.username,user.real_name,user.email,user.phone_number,user.first_name,user.last_name].some(value=>String(value||'').toLowerCase().includes(query)))
    && (!filters.organization || userOrganizations(user).includes(filters.organization))
    && (!filters.role || (filters.role==='admin' ? user.is_staff : !user.is_staff))
    && (!filters.account || (filters.account==='enabled' ? user.is_active : !user.is_active))
    && (!filters.approval || approvalOf(user)===filters.approval));
}
export function maskPhone(phone?: string) { if(!phone)return ''; if(phone.includes('*'))return phone; return phone.length >= 7 ? phone.slice(0,3)+'****'+phone.slice(-4) : '****'; }
export function loginText(value?: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : value === null ? '尚未登录' : '未提供'; }
