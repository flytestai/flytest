import type { Project, ProjectMember, ProjectStatistics } from '@/services/projectService';

export function recentlyUpdated(project: Project, now = Date.now()) {
  const timestamp = Date.parse(project.updated_at);
  return Number.isFinite(timestamp) && timestamp <= now && timestamp >= now - 30 * 86400000;
}

/** Only non-overlapping case categories supplied by the existing statistics API. */
export function projectCaseAssets(statistics: ProjectStatistics): number | null {
  const counts = [statistics.testcases?.total, statistics.api_automation?.test_cases, statistics.ui_automation?.total_cases];
  if (counts.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  return (counts as number[]).reduce((sum, value) => sum + value, 0);
}

export function uniqueProjectMembers(groups: (ProjectMember[] | null | undefined)[]): number | null {
  if (groups.some(group => !Array.isArray(group))) return null;
  return new Set(groups.flatMap(group => group!.map(member => member.user))).size;
}

export function filterProjects(projects: Project[], query: string, activity: string, creator: string, sort: string, now = Date.now()) {
  const search = query.trim().toLowerCase();
  return projects.filter(project => (!search || [project.id, project.name, project.description].some(value => String(value || '').toLowerCase().includes(search)))
    && (!creator || String(project.creator) === creator)
    && (!activity || (activity === 'recent' ? recentlyUpdated(project, now) : !recentlyUpdated(project, now))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : ((Date.parse(sort === 'created' ? b.created_at : b.updated_at) || 0) - (Date.parse(sort === 'created' ? a.created_at : a.updated_at) || 0)) || b.id - a.id);
}
