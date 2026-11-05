<template>
  <section class="project-reference">
    <header class="project-reference-hero"><div><h1>项目管理</h1><p>管理项目、团队成员与测试资产，协同推进测试工作，提升研发与测试效率。</p></div><svg viewBox="0 0 500 130" aria-hidden="true"><path d="M0 130C140-10 270-20 500 80v50" fill="currentColor" opacity=".06"/><path d="M65 130C280-70 350 40 500 30v100" fill="currentColor" opacity=".15"/><path d="M230 130C350 30 420 20 500 36v94" fill="currentColor" opacity=".2"/></svg></header>
    <div class="project-reference-metrics"><article v-for="metric in metrics" :key="metric.title"><span><component :is="metric.icon" /></span><div><small>{{ metric.title }}</small><strong>{{ number(metric.value) }}</strong><p>{{ metric.hint }}</p></div><component :is="metric.icon" class="project-reference-metric-art" /></article></div>
    <a-alert v-if="error" type="error">{{ error }} <a-button type="text" @click="$emit('refresh')">重试</a-button></a-alert>
    <div class="project-reference-columns">
      <main class="project-reference-list">
        <div class="project-reference-toolbar"><a-input v-model="query" allow-clear placeholder="搜索项目名称、描述或 ID" :input-attrs="{ 'aria-label': '搜索项目' }"><template #prefix><icon-search /></template></a-input><a-select v-model="activity" aria-label="项目活跃度"><a-option value="">全部活跃度</a-option><a-option value="recent">近 30 天更新</a-option><a-option value="older">较早更新</a-option></a-select><a-select v-model="creator" aria-label="项目创建人"><a-option value="">全部创建人</a-option><a-option v-for="owner in creators" :key="owner.id" :value="String(owner.id)">{{ owner.name }}</a-option></a-select><a-select v-model="sort" aria-label="项目排序"><a-option value="updated">最近更新</a-option><a-option value="created">最近创建</a-option><a-option value="name">项目名称</a-option></a-select><a-button aria-label="刷新项目" :loading="loading" @click="$emit('refresh')"><icon-refresh /></a-button><a-button type="primary" :disabled="!canCreate" @click="$emit('create')"><template #icon><icon-plus /></template>新建项目</a-button></div>
        <div class="project-reference-scope"><span>{{ filtered.length }} 个项目 <i v-if="query || creator || activity">· 已筛选</i></span><a-tooltip content="成员与用例资产仅统计当前页；资产包含手工、API 和 Web 用例，不含执行记录。"><span><icon-info-circle />统计范围：当前页</span></a-tooltip></div>
        <a-table class="project-reference-table" row-key="id" :data="pageRows" :loading="loading" :pagination="false" :bordered="false" :scroll="{ x: 980 }">
          <template #columns>
            <a-table-column title="项目ID" data-index="id" :width="65" />
            <a-table-column title="项目名称" :width="170"><template #cell="{ record }"><div class="project-reference-name-cell"><span><icon-layers /></span><button @click="$emit('open', record)">{{ record.name }}</button></div></template></a-table-column>
            <a-table-column title="项目描述" :width="145"><template #cell="{ record }"><span class="project-reference-description" :title="record.description">{{ record.description || '暂无描述' }}</span></template></a-table-column>
            <a-table-column title="创建人" :width="90"><template #cell="{ record }"><span class="project-reference-person"><i>{{ creatorName(record).slice(0, 2).toUpperCase() }}</i>{{ creatorName(record) }}</span></template></a-table-column>
            <a-table-column title="成员数" :width="75"><template #cell="{ record }"><a-tooltip :content="details[record.id]?.members === null ? '成员读取失败，可刷新重试' : '查看项目成员'"><button class="project-reference-count-link" @click="$emit('members', record)"><icon-user-group />{{ details[record.id]?.members?.length ?? '—' }}</button></a-tooltip></template></a-table-column>
            <a-table-column title="用例资产" :width="80"><template #cell="{ record }"><a-tooltip content="手工、API 和 Web 用例合计"><button class="project-reference-count-link" @click="$emit('assets', record)"><icon-layers />{{ number(details[record.id]?.assets) }}</button></a-tooltip></template></a-table-column>
            <a-table-column title="最近更新" :width="130"><template #cell="{ record }"><span class="project-reference-updated" :title="record.updated_at">{{ date(record.updated_at) }}</span></template></a-table-column>
            <a-table-column title="活跃度" :width="90"><template #cell="{ record }"><a-tag :color="recentlyUpdated(record) ? 'green' : 'gray'">{{ recentlyUpdated(record) ? '近期更新' : '较早更新' }}</a-tag></template></a-table-column>
            <a-table-column title="操作" :width="145" fixed="right"><template #cell="{ record }"><div class="project-reference-row-actions"><a-button size="mini" :aria-label="'成员 ' + record.name" @click="$emit('members', record)"><icon-user-group />成员</a-button><a-button size="mini" :disabled="!canEdit(record)" :aria-label="'编辑 ' + record.name" @click="$emit('edit', record)"><icon-edit />编辑</a-button><a-dropdown @select="(value: string) => more(value, record)"><a-button size="mini" :aria-label="'更多 ' + record.name"><icon-more /></a-button><template #content><a-doption value="open">进入项目</a-doption><a-doption value="assets">查看用例资产</a-doption><a-doption value="delete" :disabled="!canDelete(record)">申请删除</a-doption></template></a-dropdown></div></template></a-table-column>
          </template>
          <template #empty><div class="project-reference-empty"><icon-folder /><strong>{{ error ? '项目加载失败' : query || creator || activity ? '没有匹配的项目' : '开始管理您的第一个项目' }}</strong><p>{{ error ? '请重试后查看项目数据' : '集中管理测试资产，让团队协作更清晰' }}</p><a-button v-if="!error" :disabled="!canCreate && !filteredActive" @click="filteredActive ? resetFilters() : $emit('create')">{{ filteredActive ? '重置筛选' : '新建项目' }}</a-button></div></template>
        </a-table>
        <footer class="project-reference-pagination"><span>共 {{ filtered.length.toLocaleString() }} 条</span><a-pagination :current="page" :total="filtered.length" :page-size="pageSize" show-page-size size="small" :page-size-options="[10,20,50]" @change="page = $event" @page-size-change="pageSize = $event; page = 1" /></footer>
      </main>
      <aside class="project-reference-insights">
        <section class="project-reference-side-card"><h2><icon-bar-chart />项目协作概览<a-tooltip content="依据可见项目的更新时间划分活跃度，非项目工作流状态。"><icon-info-circle /></a-tooltip></h2><div class="project-reference-overview"><div class="project-reference-donut" :style="{ background: donutBackground }"><div><strong>{{ loading && !projects.length ? '—' : projects.length }}</strong><span>可见项目</span></div></div><div class="project-reference-legend"><div><i class="teal" />近 30 天更新<strong>{{ recentCount }}</strong><small>{{ ratio(recentCount) }}%</small></div><div><i class="blue" />较早更新<strong>{{ projects.length - recentCount }}</strong><small>{{ ratio(projects.length - recentCount) }}%</small></div></div></div></section>
        <section class="project-reference-side-card"><h2><icon-clock-circle />最近项目更新<button @click="activityVisible = true">全部更新 <icon-right /></button></h2><div v-if="latestProjects.length" class="project-reference-timeline"><button v-for="project in latestProjects.slice(0,4)" :key="project.id" @click="$emit('open', project)"><i /><span class="project-reference-event-icon"><icon-edit /></span><div><strong>{{ project.name }}</strong><p>项目资料最近更新</p></div><time>{{ date(project.updated_at) }}</time></button></div><div v-else class="project-reference-side-empty">暂无可见项目更新</div></section>
        <section class="project-reference-side-card project-reference-permissions"><h2><icon-safe />权限说明<button aria-label="查看项目权限说明" @click="permissionsVisible = true"><icon-right /></button></h2><p>项目访问与管理由系统权限及成员角色共同决定。删除项目需提交申请并由管理员审核。</p><button @click="permissionsVisible = true">查看角色与权限规则 <icon-arrow-right /></button></section>
      </aside>
    </div>
    <a-modal v-model:visible="permissionsVisible" title="项目角色与权限说明" :width="600" :footer="false"><div class="project-reference-permission-help"><a-alert>所有操作以服务端权限校验为准；页面不会修改或自动开通权限。</a-alert><dl><dt>平台管理员</dt><dd>按系统授权访问项目，管理成员及审批删除申请。</dd><dt>项目拥有者 / 管理员</dt><dd>项目成员管理权限结合角色与系统授权判断；编辑、删除仍需对应项目模型权限。</dd><dt>普通成员</dt><dd>可查看所属项目及成员，管理操作需额外授权。</dd><dt>删除审批</dt><dd>申请删除不会立即删除项目；管理员审核通过后可在删除记录中追踪与恢复。</dd></dl><a-button v-if="isAdmin" @click="router.push('/project-deletion-logs')">查看项目删除记录</a-button></div></a-modal>
    <a-modal v-model:visible="activityVisible" title="最近项目更新" :width="600" :footer="false"><p class="project-reference-activity-hint">按项目资料更新时间排序；这里不是操作人审计日志。</p><a-list :data="latestProjects" :max-height="420"><template #item="{ item }"><a-list-item><button class="project-reference-activity-link" @click="activityVisible = false; $emit('open', item)">{{ item.name }}</button><template #extra>{{ date(item.updated_at) }}</template></a-list-item></template></a-list></a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/authStore';
import { getProjectMembers, getProjectStatistics, type Project, type ProjectMember } from '@/services/projectService';
import { filterProjects, recentlyUpdated, projectCaseAssets, uniqueProjectMembers } from '../projectPresentation';
import { IconFolder, IconPlayArrow, IconUserGroup, IconLayers, IconSafe, IconSearch, IconPlus, IconRefresh, IconInfoCircle, IconEdit, IconMore, IconBarChart, IconClockCircle, IconRight, IconArrowRight } from '@arco-design/web-vue/es/icon';
import './project-reference.css';
const props = defineProps<{ projects: Project[]; loading: boolean; error: string; revision: number }>();
const emit = defineEmits<{ refresh: []; create: []; members: [project: Project]; edit: [project: Project]; delete: [project: Project]; open: [project: Project]; assets: [project: Project] }>();
const auth = useAuthStore(), router = useRouter(); const query = ref(''), creator = ref(''), activity = ref(''), sort = ref('updated'); const page = ref(1), pageSize = ref(10); const permissionsVisible = ref(false), activityVisible = ref(false);
const details = ref<Record<number, { members: ProjectMember[] | null; assets: number | null }>>({}); let version = 0;
const filteredActive = computed(() => !!(query.value || creator.value || activity.value));
const filtered = computed(() => filterProjects(props.projects, query.value, activity.value, creator.value, sort.value));
const pageRows = computed(() => filtered.value.slice((page.value-1)*pageSize.value, page.value*pageSize.value));
const isAdmin = computed(() => !!auth.user?.is_staff);
const canCreate = computed(() => auth.hasPermission('projects.add_project'));
const memberOf = (project: Project) => details.value[project.id]?.members?.some(member => member.user === auth.user?.id) || false;
const canEdit = (project: Project) => auth.hasPermission('projects.change_project') && (isAdmin.value || memberOf(project));
const canDelete = (project: Project) => auth.hasPermission('projects.delete_project') && (isAdmin.value || memberOf(project));
const creatorName = (project: Project) => project.creator_detail?.username || '未知';
const creators = computed(() => [...new Map(props.projects.filter(project => project.creator).map(project => [project.creator, { id: project.creator, name: creatorName(project) }])).values()]);
const recentCount = computed(() => props.projects.filter(project => recentlyUpdated(project)).length);
const latestProjects = computed(() => [...props.projects].filter(project => Number.isFinite(Date.parse(project.updated_at))).sort((a,b) => Date.parse(b.updated_at)-Date.parse(a.updated_at)));
const membersCount = computed(() => props.error ? null : uniqueProjectMembers(pageRows.value.map(project => details.value[project.id]?.members)));
const assetsCount = computed(() => { if (props.error) return null; const values = pageRows.value.map(project => details.value[project.id]?.assets); return values.some(value => value == null) ? null : (values as number[]).reduce((sum,value) => sum+value,0); });
const permissions = ['projects.view_project','projects.add_project','projects.change_project','projects.delete_project','projects.add_projectmember','projects.change_projectmember','projects.delete_projectmember'];
const metrics = computed(() => [{ title: '项目总数', value: props.loading && !props.projects.length || props.error ? null : props.projects.length, hint: '当前账号可见的项目', icon: IconFolder }, { title: '近期更新项目', value: props.error ? null : recentCount.value, hint: '近 30 天项目资料有更新', icon: IconPlayArrow }, { title: '团队成员', value: membersCount.value, hint: '当前页成员，按账号去重', icon: IconUserGroup }, { title: '测试资产', value: assetsCount.value, hint: '当前页手工 / API / Web 用例', icon: IconLayers }, { title: '管理权限', value: permissions.filter(permission => auth.hasPermission(permission)).length, hint: '已授予的项目相关系统权限', icon: IconSafe }]);
const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
const ratio = (count: number) => props.projects.length ? (count/props.projects.length*100).toFixed(1) : '0.0';
const donutBackground = computed(() => !props.projects.length ? 'var(--theme-surface-soft)' : 'conic-gradient(#00a78f 0% '+ratio(recentCount.value)+'%, #69aaf7 '+ratio(recentCount.value)+'% 100%)');
function resetFilters() { query.value=''; activity.value=''; creator.value=''; }
function more(value: string, project: Project) { if(value==='open') emit('open', project); else if(value==='assets') emit('assets',project); else if(value==='delete' && canDelete(project)) emit('delete',project); }
watch([query,creator,activity,sort], () => { page.value=1; });
watch(() => filtered.value.length, count => { if ((page.value-1)*pageSize.value >= count) page.value=1; });
watch(() => [pageRows.value.map(project => project.id).join(','), props.revision], async () => {
  const current = ++version, projects = [...pageRows.value]; details.value = {};
  let index=0;
  async function worker() { while(current===version && index<projects.length) { const project = projects[index++]!; const [members,stats] = await Promise.allSettled([getProjectMembers(project.id),getProjectStatistics(project.id)]); if(current!==version)return; details.value = { ...details.value, [project.id]: { members: members.status==='fulfilled' && members.value.success && members.value.data ? members.value.data : null, assets: stats.status==='fulfilled' && stats.value.success && stats.value.data ? projectCaseAssets(stats.value.data) : null } }; } }
  await Promise.all(Array.from({ length: Math.min(3,projects.length) },worker));
}, { immediate:true });
onBeforeUnmount(() => { ++version; });
</script>
