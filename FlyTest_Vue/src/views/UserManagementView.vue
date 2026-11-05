<template>
  <div class="user-management fc-page">
    <UserReferenceWorkspace :users="userData" :loading="loading" :error="listError"
      @create="showAddUserModal" @refresh="refreshUserList" @edit="editUser"
      @permissions="viewUserPermissions" @toggle="toggleUser" @logs="openUserOperationLogs"
      @approve="approvePendingUser" @reject="rejectPendingUser" @delete="deleteUser" />

    <!-- 用户权限管理模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="permissionsModalVisible"
      title="用户权限管理"
      :footer="false"
      :mask-closable="true"
      :width="1200"
    >
      <permission-tree-selector
        ref="permissionTreeSelectorRef"
        type="user"
        :id="selectedUserId"
        lazy
        @refresh="refreshUserList"
      />
    </a-modal>

    <!-- 添加用户模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="addUserModalVisible"
      title="添加用户"
      @cancel="cancelAddUser"
      @before-ok="handleAddUser"
      :mask-closable="false"
      :width="600"
    >
      <a-form class="fc-form" ref="addUserFormRef" :model="addUserForm" :rules="addUserRules" layout="vertical" :auto-label-width="false">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="username" label="系统用户名" required>
              <a-input v-model="addUserForm.username" placeholder="请输入系统用户名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="email" label="联系邮箱" required>
              <a-input v-model="addUserForm.email" placeholder="请输入联系邮箱" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="password" label="密码" required>
              <a-input-password v-model="addUserForm.password" placeholder="请输入密码" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="confirmPassword" label="确认密码" required>
              <a-input-password v-model="addUserForm.confirmPassword" placeholder="请再次输入密码" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="first_name" label="名">
              <a-input v-model="addUserForm.first_name" placeholder="请输入名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="last_name" label="姓">
              <a-input v-model="addUserForm.last_name" placeholder="请输入姓" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="real_name" label="姓名">
              <a-input v-model="addUserForm.real_name" placeholder="请输入姓名（仅支持中文）" />
              <div class="form-field-tip">姓名仅支持 2 到 20 位中文，且不能与其他用户重复。</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="phone_number" label="登录手机号">
              <a-input v-model="addUserForm.phone_number" placeholder="请输入11位手机号" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="is_staff" label=" ">
              <a-checkbox v-model="addUserForm.is_staff">管理员权限</a-checkbox>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="is_active" label=" ">
              <a-checkbox v-model="addUserForm.is_active" default-checked>启用账户</a-checkbox>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 编辑用户模态框 -->
    <a-modal class="fc-dialog"
      v-model:visible="editUserModalVisible"
      title="编辑用户"
      @cancel="cancelEditUser"
      @before-ok="handleEditUser"
      :mask-closable="false"
      :width="1000"
    >
      <a-tabs class="fc-tabs" default-active-key="basic" @change="onEditUserTabChange">
        <a-tab-pane key="basic" title="基本信息">
          <a-form class="fc-form" ref="editUserFormRef" :model="editUserForm" :rules="editUserRules" layout="vertical" :auto-label-width="false">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item field="username" label="系统用户名">
                  <a-input v-model="editUserForm.username" placeholder="系统用户名由系统分配或管理员维护" disabled />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item field="email" label="联系邮箱">
                  <a-input v-model="editUserForm.email" placeholder="请输入联系邮箱" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item field="first_name" label="名">
                  <a-input v-model="editUserForm.first_name" placeholder="请输入名" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item field="last_name" label="姓">
                  <a-input v-model="editUserForm.last_name" placeholder="请输入姓" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item field="real_name" label="姓名">
                  <a-input v-model="editUserForm.real_name" placeholder="请输入姓名（仅支持中文）" />
                  <div class="form-field-tip">姓名仅支持 2 到 20 位中文，且不能与其他用户重复。</div>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item field="phone_number" label="登录手机号">
                  <a-input v-model="editUserForm.phone_number" placeholder="请输入11位手机号" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item field="is_staff" label=" ">
                  <a-checkbox v-model="editUserForm.is_staff" :disabled="editUserForm.id === authStore.user?.id">管理员权限</a-checkbox>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item field="is_active" label=" ">
                  <a-checkbox v-model="editUserForm.is_active" :disabled="editUserForm.id === authStore.user?.id">启用账户</a-checkbox>
                </a-form-item>
              </a-col>
            </a-row>

            <a-divider>修改密码（可选）</a-divider>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item field="password" label="新密码">
                  <a-input-password v-model="editUserForm.password" placeholder="请输入新密码" allow-clear />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item field="confirmPassword" label="确认新密码">
                  <a-input-password v-model="editUserForm.confirmPassword" placeholder="请再次输入新密码" allow-clear />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
        </a-tab-pane>
        
        <a-tab-pane key="permissions" title="权限管理">
          <permission-tree-selector
            ref="editPermissionTreeSelectorRef"
            v-if="editUserModalVisible && editUserForm.id"
            type="user"
            :id="editUserForm.id"
            lazy
            @refresh="refreshUserList"
          />
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import UserReferenceWorkspace from '@/features/users/components/UserReferenceWorkspace.vue'
import { useAuthStore } from '@/store/authStore'
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Message, Modal, Row as ARow, Col as ACol, Divider as ADivider } from '@arco-design/web-vue';
import {
  getUserList,
  createUser,
  deleteUser as deleteUserService,
  approveUser,
  rejectUser,
  updateUser,
  type User,
  type CreateUserRequest,
  type UpdateUserRequest
} from '@/services/userService';
import PermissionTreeSelector from '@/components/permission/PermissionTreeSelector.vue';
import { getUserDisplayName } from '@/utils/userDisplay';

const authStore = useAuthStore();
const router = useRouter();

// 加载状态
const loading = ref(false);
const listError = ref('');
let requestVersion = 0;
// 用户数据
const userData = ref<User[]>([]);

// 用户权限管理相关
const permissionsModalVisible = ref(false);
const selectedUserId = ref<number>(0);
const editPermissionTreeSelectorRef = ref<{ loadPermissions: (userId?: number) => Promise<void> } | null>(null);
const permissionTreeSelectorRef = ref<{ loadPermissions: (userId?: number) => Promise<void> } | null>(null);

// 查看用户权限
const viewUserPermissions = async (user: User) => {
  if (!authStore.hasPermission('auth.change_user')) return;
  selectedUserId.value = user.id;
  permissionsModalVisible.value = true;
  
  // 等待模态框打开后再加载权限
  await nextTick();
  if (permissionTreeSelectorRef.value) {
    await permissionTreeSelectorRef.value.loadPermissions();
  }
};

const openUserOperationLogs = (user: User) => {
  router.push({ name: 'UserOperationLogs', params: { id: user.id } });
};

// User management is global; project changes do not reset its filters.
const fetchUserList = async () => {
  const version = ++requestVersion;
  loading.value = true;
  listError.value = '';
  try {
    const collected = new Map<number, User>();
    let page = 1;
    while (true) {
      const response = await getUserList({ page, pageSize: 100, approvalStatus: 'all' });
      if (version !== requestVersion) return;
      if (!response.success || !response.data) throw new Error(response.error || '获取用户列表失败');
      const before = collected.size;
      response.data.forEach(user => collected.set(user.id, user));
      if (collected.size >= (response.total ?? response.data.length)) break;
      if (collected.size === before) throw new Error('用户列表加载不完整，请重试');
      page += 1;
    }
    userData.value = [...collected.values()];
  } catch (error) {
    if (version !== requestVersion) return;
    userData.value = [];
    listError.value = error instanceof Error ? error.message : '获取用户列表失败';
  } finally {
    if (version === requestVersion) loading.value = false;
  }
};
const refreshUserList = () => { void fetchUserList(); };
onMounted(fetchUserList);
onBeforeUnmount(() => { requestVersion += 1; });

const toggleUser = (user: User) => {
  if (user.id === authStore.user?.id || !authStore.hasPermission('auth.change_user')) return;
  const active = !user.is_active;
  Modal.confirm({
    title: active ? '启用账号' : '禁用账号',
    content: `确认${active ? '启用' : '禁用'}用户“${getUserDisplayName(user)}”的账号吗？`,
    okText: active ? '确认启用' : '确认禁用', cancelText: '取消',
    onOk: async () => {
      const response = await updateUser(user.id, { is_active: active });
      if (!response.success) { Message.error(response.error || '更新账号状态失败'); return false; }
      Message.success('账号状态已更新');
      await fetchUserList();
    },
  });
};

// 添加用户模态框相关
const addUserModalVisible = ref(false);
const addUserFormRef = ref();
const addUserForm = reactive<CreateUserRequest & { confirmPassword: string }>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  first_name: '',
  last_name: '',
  real_name: '',
  phone_number: '',
  is_staff: false,
  is_active: true
});

// 表单验证规则
const addUserRules = {
  username: [
    { required: true, message: '请输入用户名' },
    { minLength: 3, message: '用户名长度不能小于3个字符' },
    { maxLength: 150, message: '用户名长度不能超过150个字符' }
  ],
  email: [
    { required: true, message: '请输入邮箱' },
    { type: 'email', message: '请输入有效的邮箱地址' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { minLength: 8, message: '密码长度不能小于8个字符' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码' },
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value !== addUserForm.password) {
          callback('两次输入的密码不一致');
        } else {
          callback();
        }
      }
    }
  ],
  real_name: [
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value && !/^[\u4e00-\u9fff·]{2,20}$/.test(value)) {
          callback('姓名仅支持2到20位中文');
        } else {
          callback();
        }
      }
    }
  ],
  phone_number: [
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value && !/^1[3-9]\d{9}$/.test(value)) {
          callback('请输入正确的11位手机号');
        } else {
          callback();
        }
      }
    }
  ]
};

// 显示添加用户模态框
const showAddUserModal = () => {
  if (!authStore.hasPermission('auth.add_user')) return;
  // 重置表单
  Object.assign(addUserForm, {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    real_name: '',
    phone_number: '',
    is_staff: false,
    is_active: true
  });

  // 显示模态框
  addUserModalVisible.value = true;
};

// 取消添加用户
const cancelAddUser = () => {
  addUserModalVisible.value = false;
};

// 处理添加用户
const handleAddUser = async (done: (closed: boolean) => void) => {
  // 验证表单
  try {
    if (await addUserFormRef.value.validate()) { done(false); return; }
    // 验证通过，继续处理
  } catch (errors) {
    // 表单验证失败
    console.error('表单验证失败:', errors);
    done(false); // 不关闭模态框
    return;
  }

  // 创建用户数据对象
  const userData: CreateUserRequest = {
    username: addUserForm.username,
    email: addUserForm.email,
    password: addUserForm.password,
    first_name: addUserForm.first_name,
    last_name: addUserForm.last_name,
    real_name: addUserForm.real_name,
    phone_number: addUserForm.phone_number,
    is_staff: addUserForm.is_staff,
    is_active: addUserForm.is_active
  };

  try {
    // 调用创建用户API
    const response = await createUser(userData);

    if (response.success) {
      Message.success('用户创建成功');
      // 刷新用户列表
      fetchUserList();
      done(true); // 关闭模态框
    } else {
      Message.error(response.error || '创建用户失败');
      done(false); // 不关闭模态框
    }
  } catch (error) {
    console.error('创建用户出错:', error);
    Message.error('创建用户时发生错误');
    done(false); // 不关闭模态框
  }
};

// 编辑用户模态框相关
const editUserModalVisible = ref(false);
const editUserFormRef = ref();
const editUserForm = reactive<UpdateUserRequest & { confirmPassword: string, id: number }>({
  id: 0,
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  first_name: '',
  last_name: '',
  real_name: '',
  phone_number: '',
  is_staff: false,
  is_active: true
});

// 编辑用户表单验证规则
const editUserRules = {
  email: [
    { type: 'email', message: '请输入有效的邮箱地址' }
  ],
  real_name: [
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value && !/^[\u4e00-\u9fff·]{2,20}$/.test(value)) {
          callback('姓名仅支持2到20位中文');
        } else {
          callback();
        }
      }
    }
  ],
  phone_number: [
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value && !/^1[3-9]\d{9}$/.test(value)) {
          callback('请输入正确的11位手机号');
        } else {
          callback();
        }
      }
    }
  ],
  confirmPassword: [
    {
      validator: (value: string, callback: (error?: string) => void) => {
        if (value && value !== editUserForm.password) {
          callback('两次输入的密码不一致');
        } else {
          callback();
        }
      }
    }
  ]
};

// 显示编辑用户模态框
// 编辑用户弹窗中的标签切换处理
const onEditUserTabChange = async (key: string) => {
  if (key === 'permissions' && editUserForm.id) {
    await nextTick()
    editPermissionTreeSelectorRef.value?.loadPermissions(editUserForm.id)
  }
}

const editUser = async (user: User) => {
  if (!authStore.hasPermission('auth.change_user')) return;
  // 设置表单数据
  Object.assign(editUserForm, {
    id: user.id,
    username: user.username,
    email: user.email,
    password: '',
    confirmPassword: '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    real_name: user.real_name || '',
    phone_number: user.phone_number || '',
    is_staff: user.is_staff,
    is_active: user.is_active
  });

  // 显示模态框，不立即加载权限
  editUserModalVisible.value = true;
};

// 取消编辑用户
const cancelEditUser = () => {
  editUserModalVisible.value = false;
};

// 处理编辑用户
const handleEditUser = async (done: (closed: boolean) => void) => {
  // 验证表单
  try {
    if (await editUserFormRef.value.validate()) { done(false); return; }
    // 验证通过，继续处理
  } catch (errors) {
    // 表单验证失败
    console.error('表单验证失败:', errors);
    done(false); // 不关闭模态框
    return;
  }

  // 创建更新数据对象
  const updateData: UpdateUserRequest = {};

  // 只包含已修改的字段
  if (editUserForm.email) updateData.email = editUserForm.email;
  if (editUserForm.first_name !== undefined) updateData.first_name = editUserForm.first_name;
  if (editUserForm.last_name !== undefined) updateData.last_name = editUserForm.last_name;
  if (editUserForm.real_name !== undefined) updateData.real_name = editUserForm.real_name;
  if (editUserForm.phone_number !== undefined) updateData.phone_number = editUserForm.phone_number;
  if (editUserForm.id !== authStore.user?.id && editUserForm.is_staff !== undefined) updateData.is_staff = editUserForm.is_staff;
  if (editUserForm.id !== authStore.user?.id && editUserForm.is_active !== undefined) updateData.is_active = editUserForm.is_active;

  // 如果输入了密码，则包含密码字段
  if (editUserForm.password) {
    updateData.password = editUserForm.password;
  }

  try {
    // 调用更新用户API
    const response = await updateUser(editUserForm.id, updateData);

    if (response.success) {
      Message.success('用户更新成功');
      // 刷新用户列表
      fetchUserList();
      done(true); // 关闭模态框
    } else {
      Message.error(response.error || '更新用户失败');
      done(false); // 不关闭模态框
    }
  } catch (error) {
    console.error('更新用户出错:', error);
    Message.error('更新用户时发生错误');
    done(false); // 不关闭模态框
  }
};

const approvePendingUser = (user: User) => {
  if (!authStore.hasPermission('auth.change_user')) return;
  Modal.confirm({
    title: '审核通过',
    content: `确认审核通过用户“${getUserDisplayName(user)}”吗？通过后需要继续分配权限，用户才能看到对应菜单。`,
    okText: '确认通过',
    cancelText: '取消',
    hideCancel: false,
    onOk: async () => {
      const response = await approveUser(user.id);
      if (response.success) {
        Message.success(`已审核通过 ${getUserDisplayName(user)}`);
        fetchUserList();
          return;
      }
      Message.error(response.error || '审核通过失败');
      return false;
    },
  });
};

const rejectPendingUser = (user: User) => {
  if (user.id === authStore.user?.id || !authStore.hasPermission('auth.change_user')) return;
  Modal.warning({
    title: '驳回注册',
    content: `确认驳回用户“${getUserDisplayName(user)}”吗？驳回后该用户仍可登录，但不会拥有任何后台权限。`,
    okText: '确认驳回',
    cancelText: '取消',
    hideCancel: false,
    onOk: async () => {
      const response = await rejectUser(user.id);
      if (response.success) {
        Message.success(`已驳回 ${getUserDisplayName(user)}`);
        fetchUserList();
          return;
      }
      Message.error(response.error || '驳回失败');
      return false;
    },
  });
};

// 删除用户
const deleteUser = (user: User) => {
  if (user.id === authStore.user?.id || !authStore.hasPermission('auth.delete_user')) return;
  Modal.warning({
    title: '确认删除',
    content: `确定要删除用户 "${getUserDisplayName(user)}" 吗？此操作不可恢复。`,
    okText: '确定删除',
    cancelText: '取消',
    hideCancel: false,
    onOk: async () => {
      try {
        const response = await deleteUserService(user.id);

        if (response.success) {
          Message.success(response.message || '用户删除成功');
          // 刷新用户列表
          fetchUserList();
            } else {
          Message.error(response.error || '删除用户失败');
          return false;
        }
      } catch (error) {
        console.error('删除用户出错:', error);
        Message.error('删除用户时发生错误');
        return false;
      }
    }
  });
};
</script>

<style scoped>
.user-management { min-width: 0; }
.form-field-tip { margin-top: 6px; font-size: 12px; color: var(--color-text-3); }
</style>
