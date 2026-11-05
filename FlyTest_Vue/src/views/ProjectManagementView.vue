<template>
  <div class="project-management fc-page">
    <!-- 无项目权限时显示提示 -->
    <div v-if="permissionChecking" class="loading-container"><a-spin tip="正在加载项目" /></div>
    <div v-else-if="!hasProjectPermission" class="no-permission-panel">
      <div class="no-permission-content">
        <div class="icon-container">
          <svg class="permission-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#f5222d"/>
          </svg>
        </div>
        <h3>访问受限</h3>
        <p>您当前没有项目管理权限，请联系系统管理员申请相应权限。</p>
        <a-button type="primary" @click="contactAdmin">联系管理员</a-button>
      </div>
    </div>

    <ProjectReferenceWorkspace v-else :projects="projectData" :loading="loading" :error="projectError" :revision="workspaceRevision"
      @refresh="fetchProjectList" @create="showAddProjectModal" @members="viewProjectMembers" @edit="editProject" @delete="deleteProject" @open="openProject" @assets="openProjectAssets" />

    <!-- 项目成员管理模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="membersModalVisible"
      :title="`项目成员管理: ${selectedProject?.name || ''}`"
      :footer="false"
      :mask-closable="true"
      :width="900"
    >
      <div v-if="membersLoading" class="loading-container">
        <a-spin />
      </div>
      <div v-else>
        <div class="members-header">
          <a-button type="primary" :disabled="!canManageMembers" @click="showAddMemberModal">添加成员</a-button>
        </div>
        <div v-if="projectMembers.length === 0" class="no-data">
          暂无成员数据
        </div>
        <a-table class="fc-table"
          v-else
          :columns="memberColumns"
          :data="projectMembers"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 760 }"
        >
          <template #role="{ record }">
            <a-tag :color="record.role === 'owner' ? 'red' : record.role === 'admin' ? 'orange' : 'blue'">
              {{ record.role === 'owner' ? '拥有者' : record.role === 'admin' ? '管理员' : '成员' }}
            </a-tag>
          </template>
          <template #joined_at="{ record }">
            {{ record.joined_at ? new Date(record.joined_at).toLocaleString() : '-' }}
          </template>
          <template #operations="{ record }">
            <a-space :size="4">
              <a-button
                type="text"
                size="mini"
                @click="showUpdateRoleModal(record)"
                :disabled="record.role === 'owner' || record.user === authStore.user?.id || !canManageMembers"
              >
                修改角色
              </a-button>
              <a-button
                type="text"
                size="mini"
                status="danger"
                @click="removeMember(record)"
                :disabled="record.role === 'owner' || record.user === authStore.user?.id || !canManageMembers"
              >
                移除
              </a-button>
            </a-space>
          </template>
        </a-table>

      </div>
    </a-modal>

    <!-- 添加成员模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="addMemberModalVisible"
      title="添加项目成员"
      @before-ok="handleAddMember"
      @cancel="() => addMemberModalVisible = false"
      :mask-closable="false"
    >
      <a-form class="fc-form" :model="addMemberForm" layout="vertical">
        <a-form-item field="userId" label="选择用户" required>
          <a-select
            v-model="addMemberForm.userId"
            placeholder="请选择用户"
            :loading="usersLoading"
            :filter-option="true"
          >
            <a-option
              v-for="user in availableUsers"
              :key="user.value"
              :value="user.value"
              :label="user.label"
            />
          </a-select>
        </a-form-item>
        <a-form-item field="role" label="角色" required>
          <a-select v-model="addMemberForm.role" placeholder="请选择角色">
            <a-option value="member">成员</a-option>
            <a-option value="admin">管理员</a-option>
            <a-option value="owner">拥有者</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 更新角色模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="updateRoleModalVisible"
      title="更新成员角色"
      @before-ok="handleUpdateRole"
      @cancel="() => updateRoleModalVisible = false"
      :mask-closable="false"
    >
      <a-form class="fc-form" :model="updateRoleForm" layout="vertical">
        <a-form-item field="role" label="角色" required>
          <a-select v-model="updateRoleForm.role" placeholder="请选择角色">
            <a-option value="member">成员</a-option>
            <a-option value="admin">管理员</a-option>
            <a-option value="owner">拥有者</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 添加项目模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="addProjectModalVisible"
      title="添加项目"
      @before-ok="handleAddProject"
      @cancel="cancelAddProject"
      :mask-closable="false"
      width="700px"
    >
      <a-form class="fc-form"
        ref="addProjectFormRef"
        :model="addProjectForm"
        :rules="addProjectRules"
        layout="vertical"
      >
        <a-form-item field="name" label="项目名称">
          <a-input v-model="addProjectForm.name" placeholder="请输入项目名称" />
        </a-form-item>
        <a-form-item field="description" label="项目描述">
          <a-textarea
            v-model="addProjectForm.description"
            placeholder="请输入项目描述"
            :auto-size="{ minRows: 3, maxRows: 5 }"
          />
        </a-form-item>
        
        <!-- 凭据列表 -->
        <a-divider v-if="false" orientation="left">Project Credentials</a-divider>
        <div v-if="false" v-for="(credential, index) in addProjectForm.credentials" :key="index" style="margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px;">
          <a-input v-model="credential.system_url" placeholder="项目地址" style="flex: 2;" />
          <a-input v-model="credential.username" placeholder="用户名" style="flex: 1;" />
          <a-input-password v-model="credential.password" placeholder="密码" style="flex: 1;" />
          <a-input v-model="credential.user_role" placeholder="角色" style="flex: 1;" />
          <a-button type="text" status="danger" @click="removeCredential(index)">删除</a-button>
        </div>
        <a-button v-if="false" type="dashed" long @click="addCredential">
          <template #icon>
            <icon-plus />
          </template>
          添加凭据
        </a-button>
      </a-form>
    </a-modal>

    <!-- 编辑项目模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="editProjectModalVisible"
      title="编辑项目"
      @before-ok="handleEditProject"
      @cancel="cancelEditProject"
      :mask-closable="false"
      width="700px"
    >
      <a-form class="fc-form"
        ref="editProjectFormRef"
        :model="editProjectForm"
        :rules="editProjectRules"
        layout="vertical"
      >
        <a-form-item field="name" label="项目名称">
          <a-input v-model="editProjectForm.name" placeholder="请输入项目名称" />
        </a-form-item>
        <a-form-item field="description" label="项目描述">
          <a-textarea
            v-model="editProjectForm.description"
            placeholder="请输入项目描述"
            :auto-size="{ minRows: 3, maxRows: 5 }"
          />
        </a-form-item>
        
        <!-- 凭据列表 -->
        <a-divider v-if="false" orientation="left">Project Credentials</a-divider>
        <div v-if="false" v-for="(credential, index) in editProjectForm.credentials" :key="index" style="margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px;">
          <a-input v-model="credential.system_url" placeholder="项目地址" style="flex: 2;" />
          <a-input v-model="credential.username" placeholder="用户名" style="flex: 1;" />
          <a-input-password v-model="credential.password" placeholder="留空不改" style="flex: 1;" />
          <a-input v-model="credential.user_role" placeholder="角色" style="flex: 1;" />
          <a-button type="text" status="danger" @click="removeEditCredential(index)">删除</a-button>
        </div>
        <a-button v-if="false" type="dashed" long @click="addEditCredential">
          <template #icon>
            <icon-plus />
          </template>
          添加凭据
        </a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import ProjectReferenceWorkspace from '@/features/projects/components/ProjectReferenceWorkspace.vue'
import { useRouter } from 'vue-router'
import { ref, reactive, onMounted, watch, computed, onBeforeUnmount } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import {
  getProjectList,
  createProject,
  deleteProject as deleteProjectService,
  updateProject,
  getProjectDetail,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  type Project,
  type ProjectMember,
  type CreateProjectRequest,
  type UpdateProjectRequest
} from '@/services/projectService';
import { getUserList } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { getUserDisplayName } from '@/utils/userDisplay';

// 加载状态
const loading = ref(false);
const permissionChecking = ref(true);
const projectError = ref('');
const workspaceRevision = ref(0);
const router = useRouter();
let listVersion = 0, membersVersion = 0;
// 搜索关键词
const searchKeyword = ref('');

// 权限检查
const authStore = useAuthStore();
const projectStore = useProjectStore();
const hasProjectPermission = ref(false); // 默认无权限，等待权限检查结果

// 简单的权限检查逻辑
const checkProjectPermission = () => {
  // 如果用户未登录，则无权限
  if (!authStore.isAuthenticated || !authStore.user) {
    hasProjectPermission.value = false;
    return;
  }
  
  // 如果是管理员，拥有所有权限
  if (authStore.user?.is_staff) {
    hasProjectPermission.value = true;
    return;
  }
  
  // 检查是否有项目相关权限
  const projectPermissions = [
    'projects.view_project',
    'projects.add_project',  
    'projects.change_project',
    'projects.delete_project'
  ];
  
  // 使用authStore的hasPermission方法检查权限
  hasProjectPermission.value =
    projectPermissions.some(permission => authStore.hasPermission(permission)) ||
    projectStore.projectList.length > 0 ||
    projectData.value.length > 0;
};

// 联系管理员
const contactAdmin = () => {
  Message.info('请联系系统管理员获取项目管理权限');
};

// 表格列定义
const columns = [
  {
    title: '项目ID',
    dataIndex: 'id',
    width: 80,
  },
  {
    title: '项目名称',
    dataIndex: 'name',
    slotName: 'name',
    width: 200,
  },
  {
    title: '项目描述',
    dataIndex: 'description',
    slotName: 'description',
    width: 300,
  },
  {
    title: '创建者',
    dataIndex: 'creator_detail',
    render: ({ record }: { record: Project }) => {
      return getUserDisplayName(record.creator_detail);
    }
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    render: ({ record }: { record: Project }) => {
      const date = new Date(record.created_at);
      return date.toLocaleString();
    }
  },
  {
    title: '操作',
    slotName: 'operations',
    width: 210,
    fixed: 'right',
  },
];

// 项目数据
const projectData = ref<Project[]>([]);

// 分页配置
const pagination = reactive({
  total: 0,
  current: 1,
  pageSize: 10,
  showTotal: true,
  showJumper: true,
  showPageSize: true,
  pageSizeOptions: [10, 20, 50, 100],
});

const fetchProjectList = async () => {
  const version = ++listVersion;
  loading.value = true; projectError.value = '';
  try {
    const response = await getProjectList();
    if (version !== listVersion) return;
    if (!response.success || !response.data) throw new Error(response.error || '获取项目列表失败');
    projectData.value = response.data;
    pagination.total = response.data.length;
    projectStore.projectList = response.data;
    const active = response.data.find(project => project.id === projectStore.currentProjectId) || response.data[0];
    if (active) projectStore.setCurrentProject(active);
    else { projectStore.currentProject = null; localStorage.removeItem('selected_project_id'); }
    workspaceRevision.value++;
    checkProjectPermission();
  } catch (error) {
    if (version === listVersion) { projectData.value = []; pagination.total = 0; projectError.value = error instanceof Error ? error.message : '项目加载失败，请重试'; }
  } finally { if (version === listVersion) loading.value = false; }
};
onMounted(async () => {
  try { await authStore.bootstrapSession(); checkProjectPermission(); await fetchProjectList(); }
  finally { permissionChecking.value = false; }
});
watch(() => [authStore.isAuthenticated, authStore.userPermissions, projectStore.projectList], checkProjectPermission, { deep: true });
onBeforeUnmount(() => { ++listVersion; ++membersVersion; });
const openProject = (project: Project) => { projectStore.setCurrentProject(project); void router.push('/dashboard'); };
const openProjectAssets = (project: Project) => { projectStore.setCurrentProject(project); void router.push('/testcases'); };

// 处理行点击事件
const handleRowClick = (record: Project) => {
  console.log('点击了项目:', record);
  // 查看项目详情
  viewProjectDetail(record);
};

// 项目成员管理相关
const membersModalVisible = ref(false);
const membersLoading = ref(false);
const selectedProject = ref<Project | null>(null);
const projectMembers = ref<ProjectMember[]>([]);
const canManageMembers = computed(() => {
  if (authStore.user?.is_staff) return true;
  const self = projectMembers.value.find(member => member.user === authStore.user?.id);
  return !!self && (['owner', 'admin'].includes(self.role) || ['projects.change_project','projects.add_projectmember','projects.change_projectmember'].some(permission => authStore.hasPermission(permission)));
});

// 项目成员表格列定义
const memberColumns = [
  {
    title: '用户ID',
    dataIndex: 'user',
    width: 80,
  },
  {
    title: '用户名',
    dataIndex: 'user_detail',
    render: ({ record }: { record: ProjectMember }) => getUserDisplayName(record.user_detail),
    width: 120,
  },
  {
    title: '邮箱',
    dataIndex: 'user_detail.email',
    width: 180,
  },
  {
    title: '角色',
    dataIndex: 'role',
    slotName: 'role',
    width: 80,
  },
  {
    title: '加入时间',
    dataIndex: 'joined_at',
    slotName: 'joined_at',
    width: 155,
  },
  {
    title: '操作',
    slotName: 'operations',
    width: 150,
    fixed: 'right',
  }
];

// 监听项目成员数据变化
watch(projectMembers, () => {
  // 成员数据已更新
}, { deep: true });

// 查看项目详情
const viewProjectDetail = async (project: Project) => {
  try {
    const response = await getProjectDetail(project.id);
    if (response.success && response.data) {
      console.log('项目详情:', response.data);
      // 可以在这里添加更多处理逻辑
    } else {
      Message.error(response.error || '获取项目详情失败');
    }
  } catch (error) {
    console.error('获取项目详情出错:', error);
    Message.error('获取项目详情时发生错误');
  }
};

// 查看项目成员
const viewProjectMembers = async (project: Project, event?: Event) => {
  // 阻止事件冒泡，避免触发行点击事件
  if (event) {
    event.stopPropagation();
  }

  selectedProject.value = project;
  membersModalVisible.value = true;
  projectMembers.value = [];
  await fetchProjectMembers(project.id);
};

// 获取项目成员列表
const fetchProjectMembers = async (projectId: number) => {
  const version = ++membersVersion;
  membersLoading.value = true;
  try {
    const response = await getProjectMembers(projectId);
    if (version !== membersVersion || selectedProject.value?.id !== projectId) return;
    if (response.success && response.data) {

      projectMembers.value = response.data;
    } else {
      Message.error(response.error || '获取项目成员列表失败');
      projectMembers.value = [];
    }
  } catch (error) {
    console.error('获取项目成员列表出错:', error);
    Message.error('获取项目成员列表时发生错误');
    projectMembers.value = [];
  } finally {
    if (version === membersVersion) membersLoading.value = false;
  }
};

// 添加成员模态框相关
const addMemberModalVisible = ref(false);
const addMemberForm = reactive({
  userId: undefined as number | undefined,
  role: 'member' as string
});
const availableUsers = ref<{ label: string; value: number }[]>([]);
const usersLoading = ref(false);

// 显示添加成员模态框
const showAddMemberModal = () => {
  addMemberForm.userId = undefined;
  addMemberForm.role = 'member';
  addMemberModalVisible.value = true;
  fetchAvailableUsers();
};

// 获取可用用户列表
const fetchAvailableUsers = async () => {
  usersLoading.value = true;
  try {
    const response = await getUserList({
      page: 1,
      pageSize: 100, // 获取较多用户
    });

    if (response.success && response.data) {
      // 过滤掉已经是项目成员的用户
      const memberUserIds = projectMembers.value.map(member => member.user);
      const filteredUsers = response.data.filter(user => !memberUserIds.includes(user.id));

      // 转换为下拉选择框需要的格式
      availableUsers.value = filteredUsers.map(user => ({
        label: getUserDisplayName(user),
        value: user.id
      }));
    } else {
      Message.error(response.error || '获取用户列表失败');
      availableUsers.value = [];
    }
  } catch (error) {
    console.error('获取用户列表出错:', error);
    Message.error('获取用户列表时发生错误');
    availableUsers.value = [];
  } finally {
    usersLoading.value = false;
  }
};

// 处理添加成员
const handleAddMember = async () => {
  if (!selectedProject.value) {
    Message.error('未选择项目');
    return false;
  }

  if (!addMemberForm.userId) {
    Message.error('请选择用户');
    return false;
  }

  try {
    const response = await addProjectMember(
      selectedProject.value.id,
      addMemberForm.userId,
      addMemberForm.role
    );

    if (response.success) {
      Message.success('成员添加成功');
      addMemberModalVisible.value = false;
      // 刷新成员列表
      await fetchProjectMembers(selectedProject.value.id);
      workspaceRevision.value++;
      return true;
    } else {
      Message.error(response.error || '添加成员失败');
    }
  } catch (error) {
    console.error('添加成员出错:', error);
    Message.error('添加成员时发生错误');
  }
  return false;
};

// 移除成员
const removeMember = (member: ProjectMember) => {
  if (!selectedProject.value) {
    Message.error('未选择项目');
    return;
  }



  Modal.warning({
    title: '确认移除',
    hideCancel: false,
    content: `确定要移除成员 "${getUserDisplayName(member.user_detail)}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        const response = await removeProjectMember(selectedProject.value!.id, member.user);

        if (response.success) {
          Message.success('成员移除成功');
          // 刷新成员列表
          await fetchProjectMembers(selectedProject.value!.id);
          workspaceRevision.value++;
        } else {
          Message.error(response.error || '移除成员失败');
        }
      } catch (error) {
        console.error('移除成员出错:', error);
        Message.error('移除成员时发生错误');
      }
    }
  });
};

// 更新成员角色模态框相关
const updateRoleModalVisible = ref(false);
const selectedMember = ref<ProjectMember | null>(null);
const updateRoleForm = reactive({
  role: ''
});

// 显示更新角色模态框
const showUpdateRoleModal = (member: ProjectMember) => {
  selectedMember.value = member;
  updateRoleForm.role = member.role;
  updateRoleModalVisible.value = true;
};

// 处理更新角色
const handleUpdateRole = async () => {
  if (!selectedProject.value || !selectedMember.value) {
    Message.error('未选择项目或成员');
    return false;
  }

  try {
    const response = await updateProjectMemberRole(
      selectedProject.value.id,
      selectedMember.value.user,
      updateRoleForm.role
    );

    if (response.success) {
      Message.success('角色更新成功');
      updateRoleModalVisible.value = false;
      // 刷新成员列表
      await fetchProjectMembers(selectedProject.value.id);
      workspaceRevision.value++;
      return true;
    } else {
      Message.error(response.error || '更新角色失败');
    }
  } catch (error) {
    console.error('更新角色出错:', error);
    Message.error('更新角色时发生错误');
  }
  return false;
};

// 添加项目模态框相关
const addProjectModalVisible = ref(false);
const addProjectFormRef = ref();
const addProjectForm = reactive<CreateProjectRequest & { credentials: any[] }>({
  name: '',
  description: '',
  credentials: []
});

// 添加项目表单验证规则
const addProjectRules = {
  name: [
    { required: true, message: '请输入项目名称' },
    { maxLength: 100, message: '项目名称长度不能超过100个字符' }
  ],
  description: [
    { maxLength: 500, message: '项目描述长度不能超过500个字符' }
  ]
};

// 添加凭据
const addCredential = () => {
  if (!addProjectForm.credentials) {
    addProjectForm.credentials = [];
  }
  addProjectForm.credentials.push({
    system_url: '',
    username: '',
    password: '',
    user_role: ''
  });
};

// 删除凭据
const removeCredential = (index: number) => {
  if (addProjectForm.credentials) {
    addProjectForm.credentials.splice(index, 1);
  }
};

// 显示添加项目模态框
const showAddProjectModal = () => {
  // 重置表单
  addProjectForm.name = '';
  addProjectForm.description = '';
  addProjectForm.credentials = [];
  // Credentials UI removed
  // 显示模态框
  addProjectModalVisible.value = true;
};

// 取消添加项目
const cancelAddProject = () => {
  addProjectModalVisible.value = false;
};

// 处理添加项目
const handleAddProject = async () => {
  // 验证表单
  try {
    const errors = await addProjectFormRef.value.validate();
    if (errors) return false;
  } catch (errors) {
    console.error('表单验证失败:', errors);
    return false;
  }

  // 创建项目数据对象
  const projectData: CreateProjectRequest = {
    name: addProjectForm.name,
    description: addProjectForm.description
  };

  try {
    const response = await createProject(projectData);

    if (response.success) {
      Message.success('项目创建成功');
      await fetchProjectList();
      // 关闭模态框
      addProjectModalVisible.value = false;
      return true;
    } else {
      Message.error(response.error || '创建项目失败');
    }
  } catch (error) {
    console.error('创建项目出错:', error);
    Message.error('创建项目时发生错误');
  }
  return false;
};

// 编辑项目模态框相关
const editProjectModalVisible = ref(false);
const editProjectFormRef = ref();
const editProjectForm = reactive<UpdateProjectRequest & { id: number; credentials: any[] }>({
  id: 0,
  name: '',
  description: '',
  credentials: []
});

// 编辑项目表单验证规则
const editProjectRules = {
  name: [
    { required: true, message: '请输入项目名称' },
    { maxLength: 100, message: '项目名称长度不能超过100个字符' }
  ],
  description: [
    { maxLength: 500, message: '项目描述长度不能超过500个字符' }
  ]
};

// 编辑凭据
const addEditCredential = () => {
  if (!editProjectForm.credentials) {
    editProjectForm.credentials = [];
  }
  editProjectForm.credentials.push({
    system_url: '',
    username: '',
    password: '',
    user_role: ''
  });
};

const removeEditCredential = (index: number) => {
  if (editProjectForm.credentials) {
    editProjectForm.credentials.splice(index, 1);
  }
};

// 显示编辑项目模态框
const editProject = (project: Project, event?: Event) => {
  if (event) {
    event.stopPropagation();
  }
  
  // 设置表单数据
  editProjectForm.id = project.id;
  editProjectForm.name = project.name;
  editProjectForm.description = project.description;
  
  editProjectForm.credentials = [];

  editProjectModalVisible.value = true;
};

// 取消编辑项目
const cancelEditProject = () => {
  editProjectModalVisible.value = false;
};

// 处理编辑项目
const handleEditProject = async () => {
  try {
    const errors = await editProjectFormRef.value.validate();
    if (errors) return false;
  } catch (errors) {
    console.error('表单验证失败:', errors);
    return false;
  }

  // 更新项目数据对象
  const projectData: UpdateProjectRequest = {
    name: editProjectForm.name,
    description: editProjectForm.description
  };

  try {
    const response = await updateProject(editProjectForm.id, projectData);

    if (response.success) {
      Message.success('项目更新成功');
      await fetchProjectList();
      editProjectModalVisible.value = false;
      return true;
    } else {
      Message.error(response.error || '更新项目失败');
    }
  } catch (error) {
    console.error('更新项目出错:', error);
    Message.error('更新项目时发生错误');
  }
  return false;
};

// 删除项目
const deleteProject = (project: Project, event?: Event) => {
  // 阻止事件冒泡，避免触发行点击事件
  if (event) {
    event.stopPropagation();
  }

  Modal.warning({
    title: '申请删除项目',
    hideCancel: false,
    content: `确定要删除项目 "${project.name}" 吗？申请将提交管理员审核，审核通过后才会删除项目。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        const response = await deleteProjectService(project.id);
        if (response.success) {
          Message.success('删除申请已提交，等待管理员审核');
          // 刷新项目列表
          await fetchProjectList();
        } else {
          Message.error(response.error || '删除项目失败');
        }
      } catch (error) {
        console.error('删除项目出错:', error);
        Message.error('删除项目时发生错误');
      }
    }
  });
};
</script>

<style scoped>
.project-management {
  background: transparent;
  border: 0;
  padding: 0;
  box-shadow: none;
  height: auto;
  min-height: 100%;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 14px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.members-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  padding: 10px 0 2px;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}

.no-permission-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 40px 20px;
}

.no-permission-content {
  text-align: center;
  background: #f9f9f9;
  padding: 40px 32px;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  max-width: 400px;
  width: 100%;
}

.icon-container {
  margin-bottom: 20px;
}

.permission-icon {
  width: 48px;
  height: 48px;
  opacity: 0.8;
}

.no-permission-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 12px;
  margin-top: 0;
}

.no-permission-content p {
  font-size: 14px;
  color: var(--theme-text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

/* 文本省略样式 */
.ellipsis-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  display: block;
  box-sizing: border-box;
}

/* 确保表格单元格也遵循省略规则 */
:deep(.arco-table-td) {
  overflow: hidden;
}

:deep(.arco-table-cell) {
  overflow: hidden;
}

/* 强制表格使用固定布局以确保列宽度生效 */
:deep(.arco-table-container .arco-table-element) {
  table-layout: fixed;
}

/* 确保tooltip内容换行显示 */
:deep(.arco-tooltip-content-inner) {
  max-width: 300px;
  white-space: normal;
  word-break: break-word;
}

/* 操作按钮样式优化 */
:deep(.arco-table-th.operations-header) {
  white-space: nowrap;
}

:deep(.arco-table-td.operations-cell) {
  padding: 8px 4px;
}

:deep(.arco-btn-size-mini) {
  padding: 0 8px;
  font-size: 12px;
  height: 24px;
  line-height: 22px;
}

/* 确保操作列按钮不溢出 */
:deep(.arco-space-item) {
  margin-right: 2px !important;
}

:deep(.arco-space-item:last-child) {
  margin-right: 0 !important;
}

/* 成员管理表格样式优化 */
:deep(.arco-table-th) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.arco-table-th-title) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 操作按钮区域样式 */
:deep(.arco-table-td.operations-cell) {
  padding: 8px 4px;
}

:deep(.arco-space-item) {
  margin-right: 4px !important;
}

:deep(.arco-space-item:last-child) {
  margin-right: 0 !important;
}

/* 确保表格在模态框中的宽度合适 */
:deep(.arco-modal-body) {
  max-height: 70vh;
  overflow-y: auto;
}

:deep(.arco-table-container) {
  overflow-x: auto;
}

.project-management {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
}

.page-header {
  padding: 20px 22px;
  border-radius: 12px;
  background:
    var(--theme-surface);
  border: 1px solid var(--ui-panel-border);
  box-shadow: var(--theme-card-shadow);
}

:deep(.arco-table) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--theme-card-shadow);
}

:deep(.arco-table-container) {
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: var(--theme-surface);
}

:deep(.arco-table-th) {
  background: var(--theme-surface-soft);
  color: var(--theme-text-secondary);
  font-weight: 600;
}

:deep(.arco-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
}

:deep(.arco-table-body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.arco-table-body::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.no-permission-content {
  background:
    var(--theme-surface);
  border: 1px solid var(--ui-panel-border);
  box-shadow: var(--theme-card-shadow);
  border-radius: 12px;
}

.workspace-hero--project-command {
  gap: 14px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--ui-panel-border);
  background:
    var(--theme-surface);
  box-shadow: var(--theme-card-shadow);
  backdrop-filter: blur(16px);
}

.workspace-hero--project-command::before {
  background-image:
    none;
  background-size: 30px 30px;
  mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.08));
}

.workspace-hero--project-command::after {
  width: 160px;
  height: 160px;
  right: -44px;
  top: -56px;
  background: none;
  filter: blur(10px);
}

.workspace-hero--project-command .workspace-hero-copy {
  gap: 8px;
}

.workspace-hero--project-command .workspace-hero-eyebrow {
  padding: 5px 10px;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--theme-accent);
  background: rgba(var(--theme-accent-rgb), 0.08);
  border-color: rgba(var(--theme-accent-rgb), 0.14);
}

.workspace-hero--project-command .workspace-hero-title {
  font-size: clamp(24px, 2.5vw, 30px);
  line-height: 1.08;
  color: var(--theme-text);
}

.workspace-hero--project-command .workspace-hero-description {
  max-width: 620px;
  font-size: 13px;
  line-height: 1.58;
  color: var(--theme-text-secondary);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.workspace-hero--project-command .workspace-chip-row {
  gap: 8px;
}

.workspace-hero--project-command .workspace-chip {
  padding: 6px 10px;
  border-color: rgba(var(--theme-accent-rgb), 0.12);
  background: rgba(var(--theme-accent-rgb), 0.08);
  color: var(--theme-accent);
  font-size: 11px;
  backdrop-filter: blur(10px);
}

.workspace-hero--project-command .workspace-hero-stats {
  grid-template-columns: repeat(2, minmax(108px, 128px));
  gap: 10px;
}

.workspace-hero--project-command .workspace-stat-card {
  min-height: 92px;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 10px;
  border-color: rgba(var(--theme-accent-rgb), 0.12);
  background:
    var(--theme-surface);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(14px);
}

.workspace-hero--project-command .workspace-stat-value {
  font-size: clamp(20px, 1.8vw, 28px);
  color: var(--theme-text);
}

.workspace-hero--project-command .workspace-stat-label {
  font-size: 11px;
  color: var(--theme-text-tertiary);
}

.workspace-hero--project-command .workspace-hero-orb {
  width: 118px;
  height: 118px;
  right: 8px;
  bottom: -18px;
  opacity: 0.58;
  background:
    var(--theme-surface);
}

.ellipsis-text {
  color: var(--color-text-1);
}

:deep(.arco-modal-content) {
  border-radius: 12px;
}

:deep(.arco-modal-header) {
  border-bottom-color: var(--ui-toolbar-border);
}

:deep(.arco-modal-body) {
  background: var(--theme-surface);
}

:deep(.arco-select-view),
:deep(.arco-input-wrapper),
:deep(.arco-textarea-wrapper),
:deep(.arco-btn) {
  border-radius: 10px;
}

@media (max-width: 768px) {
  .workspace-hero--project-command {
    padding: 14px;
    border-radius: 12px;
  }

  .workspace-hero--project-command .workspace-hero-title {
    font-size: 22px;
  }
}
</style>
