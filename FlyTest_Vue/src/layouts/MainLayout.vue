<template>
  <a-layout class="main-layout" :class="{ 'layout-collapsed': collapsed, 'mobile-nav-open': mobileNavOpen }">
    <a class="skip-to-content" href="#workspace-content">跳到主要内容</a>
    <button v-if="mobileNavOpen" class="navigation-backdrop fc-native-action" aria-label="关闭导航" tabindex="-1" @click="closeNavigation" />
    <!-- 顶部导航栏 -->
    <a-layout-header class="header" :inert="mobileNavOpen || undefined">
      <button class="navigation-toggle fc-native-action" type="button" :aria-label="isMobile ? '打开导航' : (collapsed ? '展开导航' : '收起导航')" :aria-expanded="isMobile ? mobileNavOpen : !collapsed" aria-controls="workspace-navigation" @click="toggleCollapse">
        <icon-menu-unfold v-if="collapsed || isMobile" /><icon-menu-fold v-else />
      </button>
      <div class="qdesk-topbar-heading">
        <p class="qdesk-topbar-eyebrow">{{ pageMeta.eyebrow }}</p>
        <h1>{{ pageMeta.title }}</h1>
        <p class="qdesk-topbar-subtitle">{{ pageMeta.subtitle }}</p>
      </div>
      <div class="left-section">
        <div class="logo" unselectable="on">
          <img :src="brandFullLogoUrl" alt="FeiCe 飞测 Logo" class="logo-full" />
        </div>
        <div class="project-selector" v-if="showProjectSelector">
          <a-select
            v-model="selectedProjectId"
            :loading="projectStore.loading"
            :disabled="projectStore.loading"
            placeholder="请选择项目"
            class="project-select"
            aria-label="当前项目"
            @change="handleProjectChange"
            @popup-visible-change="handlePopupVisibleChange"
          >
            <a-option
              v-for="option in projectStore.projectOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </a-select>
        </div>
      </div>
      <div class="workspace-status" aria-live="polite">

        <div
          v-if="aiActivityStore.generationJobVisible"
          class="workspace-badge workspace-badge--case-generation"
          :class="`workspace-badge--case-generation-${generationBadgeState}`"
          :title="aiActivityStore.generationTooltip"
        >
          <span class="workspace-dot"></span>
          <span class="generation-badge-copy">
            <span>{{ aiActivityStore.generationStatusText }}</span>
            <span
              v-if="aiActivityStore.generationStageText && generationBadgeState === 'running'"
              class="generation-badge-stage"
            >
              {{ aiActivityStore.generationStageText }}
            </span>
          </span>
          <button
            v-if="canDismissGenerationBadge"
            type="button"
            class="generation-badge-close fc-native-action"
            aria-label="关闭生成提示"
            title="关闭生成提示"
            @click.stop="aiActivityStore.clearGenerationJob()"
          >
            <icon-close />
          </button>
        </div>
        <ImportJobStatusBadge v-if="hasApiAutomationPermission" />
      </div>
      <div class="user-info">
        <button
          type="button"
          class="theme-switch-button fc-native-action"
          :aria-label="themeButtonLabel"
          :title="themeButtonLabel"
          @click="themeStore.toggleTheme"
        >
          <icon-sun-fill v-if="themeStore.isBlack" class="theme-switch-icon" />
          <icon-moon-fill v-else class="theme-switch-icon" />
        </button>
        <NotificationCenter :is-admin="Boolean(user?.is_staff)" />
        <div class="avatar user-avatar" :title="avatarLabel" role="img" :aria-label="avatarLabel">
          <img
            v-if="uploadedAvatarUrl && !avatarImageFailed"
            :src="uploadedAvatarUrl"
            :alt="avatarLabel"
            class="user-avatar-image"
            draggable="false"
            @error="avatarImageFailed = true"
          />
          <span v-else class="user-avatar-text">{{ avatarText }}</span>
        </div>
        <a-dropdown
          trigger="click"
          class="user-dropdown-wrapper"
          :trigger-props="{ contentClass: 'user-panel-dropdown' }"
        >
          <button type="button" class="user-dropdown fc-native-action" aria-label="账户菜单">
            <span class="username">{{ displayName }}</span>
            <icon-down />
          </button>
          <template #content>
            <div class="dropdown-user-info">
              <div class="dropdown-username">{{ displayName }}</div>
              <div class="dropdown-email" v-if="user?.real_name && user?.username">{{ user.username }}</div>
              <div class="dropdown-email" v-if="user?.email">{{ user.email }}</div>
              <div class="dropdown-role" v-if="user?.is_staff">管理员</div>
            </div>
            <a-divider style="margin: 4px 0" />
            <a-doption @click="handleOpenPersonalCenter">个人中心</a-doption>
            <a-doption @click="handleLogout">退出登录</a-doption>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>

    <a-layout class="inner-layout">
      <!-- 左侧菜单栏 -->
      <a-layout-sider
        :width="216"
        :collapsed-width="64"
        :collapsed="collapsed"
        :trigger="null"
        hide-trigger
        class="sider"
        :inert="isMobile && !mobileNavOpen || undefined"
      >
        <nav id="workspace-navigation" ref="navigationRef" class="navigation-content" aria-label="主导航" :role="isMobile && mobileNavOpen ? 'dialog' : undefined" :aria-modal="isMobile && mobileNavOpen || undefined">
        <div class="sider-brand">
          <img :src="brandLogoUrl" class="sider-brand-mark" alt="" width="34" height="34" />
          <div class="sider-brand-copy">
            <strong>FeiCe</strong>
            <span>飞测 · AI 测试平台</span>
          </div>
          <button v-if="isMobile" type="button" class="navigation-close fc-native-action" aria-label="关闭导航" @click="closeNavigation"><icon-close /></button>
        </div>
        <div class="sider-context">
          <span class="sider-context-dot"></span>
          <span>测试协作工作空间</span>
        </div>
        <a-menu
          mode="vertical"
          :selected-keys="[activeMenu]"
          v-model:open-keys="openKeys"
          :auto-open-selected="true"
          :collapsed="collapsed"
          :collapsed-width="64"
          :popup-max-height="false"
          :trigger-props="{ contentClass: 'layout-menu-popup' }"
          class="menu"
          @menu-item-click="handleMenuItemClick"
          @sub-menu-click="handleSubMenuClick"
        >
          <a-menu-item key="dashboard" v-if="isApproved">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 10.5L12 5l7 5.5" />
                  <path d="M7.5 9.5V18h9V9.5" />
                  <path d="M10 18v-4h4v4" />
                </svg>
              </span>
            </template>
            <span class="menu-link" title="首页">首页</span>
          </a-menu-item>

          <a-menu-item key="projects" v-if="hasProjectsPermission">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="5" width="14" height="4" rx="1.5" />
                  <rect x="5" y="10" width="14" height="4" rx="1.5" />
                  <rect x="5" y="15" width="14" height="4" rx="1.5" />
                </svg>
              </span>
            </template>
            <span class="menu-link" title="项目管理">项目管理</span>
          </a-menu-item>

          <a-menu-item key="requirements" v-if="hasRequirementsPermission">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 4.5h6l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-7A2.5 2.5 0 0 1 6 18V6.5A2 2 0 0 1 8 4.5z" />
                  <path d="M14 4.5V8h3" />
                  <path d="M9 12h6" />
                  <path d="M9 15h4" />
                </svg>
              </span>
            </template>
            <span class="menu-link" title="需求管理">需求管理</span>
          </a-menu-item>

          <a-sub-menu key="test-management" v-if="hasTestManagementMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="4" width="14" height="16" rx="3" />
                  <path d="M9 9h6" />
                  <path d="M9 13h3" />
                  <path d="M13.5 13.5l1.5 1.5 3-3" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="测试管理">测试管理</span></template>
            <a-menu-item key="testcases" v-if="hasTestcasesPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="测试用例">测试用例</span>
            </a-menu-item>
            <a-menu-item key="testsuites" v-if="hasTestSuitesPermission">
              <template #icon><icon-folder /></template>
              <span class="menu-link" title="测试套件">测试套件</span>
            </a-menu-item>
            <a-menu-item key="test-bugs" v-if="hasTestBugsPermission">
              <template #icon><icon-bug /></template>
              <span class="menu-link" title="BUG管理">BUG管理</span>
            </a-menu-item>
            <a-menu-item key="test-executions" v-if="hasTestExecutionsPermission">
              <template #icon><icon-history /></template>
              <span class="menu-link" title="测试报告">测试报告</span>
            </a-menu-item>
          </a-sub-menu>

          <a-sub-menu key="api-automation" v-if="hasApiAutomationMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="6" width="16" height="12" rx="3" />
                  <path d="M9 10l-2 2 2 2" />
                  <path d="M15 10l2 2-2 2" />
                  <path d="M11.5 15l1-6" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="AI接口自动化">AI接口自动化</span></template>
            <a-menu-item key="api-automation-requests" v-if="hasApiAutomationRequestsPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="请求管理">请求管理</span>
            </a-menu-item>
            <a-menu-item key="api-automation-test-cases" v-if="hasApiAutomationTestCasesPermission">
              <template #icon><icon-folder /></template>
              <span class="menu-link" title="测试用例">测试用例</span>
            </a-menu-item>
            <a-menu-item key="api-automation-environments" v-if="hasApiAutomationEnvironmentsPermission">
              <template #icon><icon-tool /></template>
              <span class="menu-link" title="环境配置">环境配置</span>
            </a-menu-item>
            <a-menu-item key="api-automation-execution-records" v-if="hasApiAutomationExecutionRecordsPermission">
              <template #icon><icon-history /></template>
              <span class="menu-link" title="执行记录">执行记录</span>
            </a-menu-item>
            <a-menu-item key="api-automation-execution-report" v-if="hasApiAutomationExecutionReportPermission">
              <template #icon><icon-bar-chart /></template>
              <span class="menu-link" title="测试报告">测试报告</span>
            </a-menu-item>
          </a-sub-menu>

          <a-sub-menu key="ui-automation" v-if="hasUiAutomationMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="5" width="16" height="11" rx="2.5" />
                  <path d="M9 19h6" />
                  <path d="M12 16v3" />
                  <path d="M10 9l-2 2 2 2" />
                  <path d="M14 9l2 2-2 2" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="UI自动化">UI自动化</span></template>
            <a-menu-item key="ui-automation-ai-intelligent" v-if="hasUiAutomationAiIntelligentPermission">
              <template #icon><icon-message /></template>
              <span class="menu-link" title="AI智能模式">AI智能模式</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-pages" v-if="hasUiAutomationPagesPermission">
              <template #icon><icon-computer /></template>
              <span class="menu-link" title="页面管理">页面管理</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-page-steps" v-if="hasUiAutomationPageStepsPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="页面步骤">页面步骤</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-testcases" v-if="hasUiAutomationTestCasesPermission">
              <template #icon><icon-folder /></template>
              <span class="menu-link" title="测试用例">测试用例</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-execution-records" v-if="hasUiAutomationExecutionRecordsPermission">
              <template #icon><icon-history /></template>
              <span class="menu-link" title="执行记录">执行记录</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-batch-records" v-if="hasUiAutomationBatchRecordsPermission">
              <template #icon><icon-bar-chart /></template>
              <span class="menu-link" title="批量执行">批量执行</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-public-data" v-if="hasUiAutomationPublicDataPermission">
              <template #icon><icon-book /></template>
              <span class="menu-link" title="公共数据">公共数据</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-env-config" v-if="hasUiAutomationEnvConfigPermission">
              <template #icon><icon-tool /></template>
              <span class="menu-link" title="环境配置">环境配置</span>
            </a-menu-item>
            <a-menu-item key="ui-automation-actuators" v-if="hasUiAutomationActuatorsPermission">
              <template #icon><icon-apps /></template>
              <span class="menu-link" title="执行器">执行器</span>
            </a-menu-item>
          </a-sub-menu>

          <a-sub-menu key="app-automation" v-if="hasAppAutomationMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="7" y="3.5" width="10" height="17" rx="3" />
                  <path d="M10 6.5h4" />
                  <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="APP自动化">APP自动化</span></template>
            <a-menu-item key="app-automation-overview" v-if="hasAppAutomationOverviewPermission">
              <template #icon><icon-home /></template>
              <span class="menu-link" title="概览">概览</span>
            </a-menu-item>
            <a-menu-item key="app-automation-devices" v-if="hasAppAutomationDevicesPermission">
              <template #icon><icon-storage /></template>
              <span class="menu-link" title="设备管理">设备管理</span>
            </a-menu-item>
            <a-menu-item key="app-automation-packages" v-if="hasAppAutomationPackagesPermission">
              <template #icon><icon-folder /></template>
              <span class="menu-link" title="应用包">应用包</span>
            </a-menu-item>
            <a-menu-item key="app-automation-elements" v-if="hasAppAutomationElementsPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="元素管理">元素管理</span>
            </a-menu-item>
            <a-menu-item key="app-automation-scene-builder" v-if="hasAppAutomationSceneBuilderPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="场景编排">场景编排</span>
            </a-menu-item>
            <a-menu-item key="app-automation-test-cases" v-if="hasAppAutomationTestCasesPermission">
              <template #icon><icon-experiment /></template>
              <span class="menu-link" title="测试用例">测试用例</span>
            </a-menu-item>
            <a-menu-item key="app-automation-suites" v-if="hasAppAutomationSuitesPermission">
              <template #icon><icon-folder /></template>
              <span class="menu-link" title="测试套件">测试套件</span>
            </a-menu-item>
            <a-menu-item key="app-automation-executions" v-if="hasAppAutomationExecutionsPermission">
              <template #icon><icon-history /></template>
              <span class="menu-link" title="执行记录">执行记录</span>
            </a-menu-item>
            <a-menu-item key="app-automation-scheduled-tasks" v-if="hasAppAutomationScheduledTasksPermission">
              <template #icon><icon-tool /></template>
              <span class="menu-link" title="定时任务">定时任务</span>
            </a-menu-item>
            <a-menu-item key="app-automation-notifications" v-if="hasAppAutomationNotificationsPermission">
              <template #icon><icon-message /></template>
              <span class="menu-link" title="通知日志">通知日志</span>
            </a-menu-item>
            <a-menu-item key="app-automation-reports" v-if="hasAppAutomationReportsPermission">
              <template #icon><icon-bar-chart /></template>
              <span class="menu-link" title="执行报告">执行报告</span>
            </a-menu-item>
            <a-menu-item key="app-automation-settings" v-if="hasAppAutomationSettingsPermission">
              <template #icon><icon-tool /></template>
              <span class="menu-link" title="环境设置">环境设置</span>
            </a-menu-item>
          </a-sub-menu>

          <a-menu-item key="langgraph-chat" v-if="hasLangGraphChatPermission">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M7.5 6h9A3.5 3.5 0 0 1 20 9.5v4a3.5 3.5 0 0 1-3.5 3.5H12l-4.5 3v-3H7.5A3.5 3.5 0 0 1 4 13.5v-4A3.5 3.5 0 0 1 7.5 6z" />
                  <path d="M8.5 10h7" />
                  <path d="M8.5 13h4.5" />
                </svg>
              </span>
            </template>
            <span class="menu-link" title="AI 对话">AI 对话</span>
          </a-menu-item>

          <a-menu-item key="knowledge-management" v-if="hasKnowledgePermission">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 5.5h5a3 3 0 0 1 3 3v10H9a3 3 0 0 0-3 3V5.5z" />
                  <path d="M18 5.5h-5a3 3 0 0 0-3 3v10h5a3 3 0 0 1 3 3V5.5z" />
                </svg>
              </span>
            </template>
            <span class="menu-link" title="知识库管理">知识库管理</span>
          </a-menu-item>
          <a-sub-menu key="data-factory" v-if="hasDataFactoryMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 4l6 3.5-6 3.5-6-3.5L12 4z" />
                  <path d="M6 11.5l6 3.5 6-3.5" />
                  <path d="M6 15.5l6 3.5 6-3.5" />
                  <path d="M12 11v8" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="数据工厂">数据工厂</span></template>
            <a-menu-item key="data-factory-all" v-if="hasDataFactoryPermission">
              <template #icon><icon-apps /></template>
              <span class="menu-link" title="工具面板">工具面板</span>
            </a-menu-item>
            <a-menu-item key="data-factory-string" v-if="hasDataFactoryPermission">
              <template #icon><icon-font-colors /></template>
              <span class="menu-link" title="字符工具">字符工具</span>
            </a-menu-item>
            <a-menu-item key="data-factory-encoding" v-if="hasDataFactoryPermission">
              <template #icon><icon-code-block /></template>
              <span class="menu-link" title="编码工具">编码工具</span>
            </a-menu-item>
            <a-menu-item key="data-factory-random" v-if="hasDataFactoryPermission">
              <template #icon><icon-fire /></template>
              <span class="menu-link" title="随机工具">随机工具</span>
            </a-menu-item>
            <a-menu-item key="data-factory-encryption" v-if="hasDataFactoryPermission">
              <template #icon><icon-lock /></template>
              <span class="menu-link" title="加密工具">加密工具</span>
            </a-menu-item>
            <a-menu-item key="data-factory-test-data" v-if="hasDataFactoryPermission">
              <template #icon><icon-user-group /></template>
              <span class="menu-link" title="测试数据">测试数据</span>
            </a-menu-item>
            <a-menu-item key="data-factory-json" v-if="hasDataFactoryPermission">
              <template #icon><icon-file /></template>
              <span class="menu-link" title="JSON工具">JSON工具</span>
            </a-menu-item>
            <a-menu-item key="data-factory-crontab" v-if="hasDataFactoryPermission">
              <template #icon><icon-clock-circle /></template>
              <span class="menu-link" title="Crontab工具">Crontab工具</span>
            </a-menu-item>
          </a-sub-menu>


          <a-sub-menu key="settings" v-if="hasSystemMenuItems">
            <template #icon>
              <span class="menu-parent-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 4.5v2" />
                  <path d="M12 17.5v2" />
                  <path d="M4.5 12h2" />
                  <path d="M17.5 12h2" />
                  <path d="M6.7 6.7l1.4 1.4" />
                  <path d="M15.9 15.9l1.4 1.4" />
                  <path d="M17.3 6.7l-1.4 1.4" />
                  <path d="M8.1 15.9l-1.4 1.4" />
                </svg>
              </span>
            </template>
            <template #title><span class="menu-title-text" title="系统管理">系统管理</span></template>
            <a-menu-item key="users" v-if="hasUsersPermission">
              <template #icon><icon-user /></template>
              <span class="menu-link" title="用户管理">用户管理</span>
            </a-menu-item>
            <a-menu-item key="organizations" v-if="hasOrganizationsPermission">
              <template #icon><icon-apps /></template>
              <span class="menu-link" title="组织管理">组织管理</span>
            </a-menu-item>
            <a-menu-item key="permissions" v-if="hasPermissionsPermission">
              <template #icon><icon-safe /></template>
              <span class="menu-link" title="权限管理">权限管理</span>
            </a-menu-item>
            <a-menu-item key="project-deletion-logs" v-if="hasProjectDeletionLogsPermission">
              <template #icon><icon-history /></template>
              <span class="menu-link" title="项目删除记录">项目删除记录</span>
            </a-menu-item>
            <a-menu-item key="llm-configs" v-if="hasLlmConfigsPermission">
              <template #icon><icon-tool /></template>
              <span class="menu-link" title="AI大模型配置">AI大模型配置</span>
            </a-menu-item>
            <a-menu-item key="api-keys" v-if="hasApiKeysPermission">
              <template #icon><icon-safe /></template>
              <span class="menu-link" title="API KEY 管理">API KEY 管理</span>
            </a-menu-item>
            <a-menu-item key="remote-mcp-configs" v-if="hasMcpConfigsPermission">
              <template #icon><icon-cloud /></template>
              <span class="menu-link" title="MCP 配置">MCP 配置</span>
            </a-menu-item>
            <a-menu-item key="skills" v-if="hasSkillsPermission">
              <template #icon><icon-apps /></template>
              <span class="menu-link" title="Skills 管理">Skills 管理</span>
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
        <!-- 侧边栏底部收起/展开按钮 -->
        <div class="sider-footer">
        <div v-if="!collapsed" class="workspace-badge sider-ai-status" :class="`workspace-badge--${aiStatus.state}`" :title="aiStatusTooltip">
          <span class="workspace-dot"></span>
          <span>{{ aiStatusLabel }}</span>
        </div>
          <a-button
            type="text"
            size="small"
            @click="toggleCollapse"
            class="collapse-button"
            :aria-label="collapsed ? '展开导航' : '收起导航'"
          >
            <template #icon>
              <icon-menu-fold v-if="!collapsed" />
              <icon-menu-unfold v-else />
            </template>
            <span v-if="!collapsed">收起导航</span>
          </a-button>
        </div>
        </nav>
      </a-layout-sider>

      <!-- 右侧内容区域 -->
      <a-layout-content id="workspace-content" role="main" tabindex="-1" class="content" :inert="mobileNavOpen || undefined" :class="{ 'content--chat': activeMenu === 'langgraph-chat', 'content--workspace': isWorkspacePage }">
        <router-view v-slot="{ Component }">
          <keep-alive include="LangGraphChat">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { useThemeStore } from '@/store/themeStore';
import { useAiActivityStore } from '@/store/aiActivityStore';
import { useWorkspaceNavigation } from '@/composables/useWorkspaceNavigation';
import { brandFullLogoUrl, brandLogoUrl } from '@/utils/assetUrl';
import NotificationCenter from '@/components/notifications/NotificationCenter.vue';
import ImportJobStatusBadge from '@/features/api-automation/components/ImportJobStatusBadge.vue';
import { fetchModels, getActiveLlmConfig, testLlmConnection } from '@/features/langgraph/services/llmConfigService';
import type { LlmConfig } from '@/features/langgraph/types/llmConfig';
import {
  Layout as ALayout,
  Menu as AMenu,
  Dropdown as ADropdown,
  Doption as ADoption,
  SubMenu as ASubMenu,
  Select as ASelect,
  Message
} from '@arco-design/web-vue';
import {
  IconSettings,
  IconUser,
  IconDown,
  IconApps,
  IconSafe,
  IconMenuFold,
  IconMenuUnfold,
  IconStorage,
  IconCodeBlock,
  IconFile,
  IconTool,
  IconMessage,
  IconCloud,
  IconBook,
  IconFolder,
  IconHistory,
  IconBug,
  IconExperiment,
  IconHome,
  IconComputer,
  IconBarChart,
  IconClockCircle,
  IconFire,
  IconFontColors,
  IconLock,
  IconClose,
  IconSunFill,
  IconMoonFill,
  IconUserGroup,
} from '@arco-design/web-vue/es/icon';

const ALayoutHeader = ALayout.Header;
const ALayoutSider = ALayout.Sider;
const ALayoutContent = ALayout.Content;
const AMenuItem = AMenu.Item;
const AOption = ASelect.Option;

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const projectStore = useProjectStore();
const themeStore = useThemeStore();
const aiActivityStore = useAiActivityStore();
const AI_STATUS_REFRESH_INTERVAL_MS = 30000;
type AiStatusState = 'checking' | 'online' | 'warning' | 'offline' | 'unconfigured';
const aiStatus = ref<{
  state: AiStatusState;
  configName: string;
  modelName: string;
  message: string;
}>({
  state: 'checking',
  configName: '',
  modelName: '',
  message: '正在检测 AI 接口状态'
});
let aiStatusTimer: ReturnType<typeof setTimeout> | null = null;
let aiStatusRefreshInFlight = false;

const aiStatusLabel = computed(() => {
  switch (aiStatus.value.state) {
    case 'online':
      return 'AI 在线';
    case 'warning':
      return 'AI 异常';
    case 'offline':
      return 'AI 离线';
    case 'unconfigured':
      return 'AI 未配置';
    default:
      return 'AI 检测中';
  }
});

const aiStatusTooltip = computed(() => {
  const parts = [aiStatusLabel.value];
  if (aiStatus.value.modelName) {
    parts.push(`模型: ${aiStatus.value.modelName}`);
  } else if (aiStatus.value.configName) {
    parts.push(`配置: ${aiStatus.value.configName}`);
  }
  if (aiStatus.value.message) {
    parts.push(aiStatus.value.message);
  }
  return parts.join(' 路 ');
});

const generationBadgeState = computed(() => {
  const status = aiActivityStore.generationJob?.status;
  if (status === 'success') {
    return 'success';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'running';
});

const canDismissGenerationBadge = computed(() => {
  const status = aiActivityStore.generationJob?.status;
  return status === 'success' || status === 'failed';
});

const clearAiStatusTimer = () => {
  if (aiStatusTimer !== null) {
    clearTimeout(aiStatusTimer);
    aiStatusTimer = null;
  }
};

const scheduleAiStatusRefresh = (delay = AI_STATUS_REFRESH_INTERVAL_MS) => {
  clearAiStatusTimer();
  aiStatusTimer = setTimeout(() => {
    void refreshAiStatus({ silent: true });
  }, delay);
};

const refreshAiStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
  if (aiStatusRefreshInFlight) {
    return;
  }

  aiStatusRefreshInFlight = true;
  if (!silent) {
    aiStatus.value = {
      ...aiStatus.value,
      state: 'checking',
      message: '正在检测 AI 接口状态'
    };
  }

  try {
    const activeConfigResponse = await getActiveLlmConfig();
    const activeConfig: LlmConfig | null = activeConfigResponse.data;

    if (activeConfigResponse.status !== 'success' || !activeConfig) {
      aiStatus.value = {
        state: 'unconfigured',
        configName: '',
        modelName: '',
        message: activeConfigResponse.status === 'success'
          ? '当前没有激活的 AI 配置'
          : (activeConfigResponse.message || '无法获取 AI 配置')
      };
      scheduleAiStatusRefresh();
      return;
    }

    let remoteStatus: string = 'error';
    let message = '';

    const fetchModelsResponse = await fetchModels(activeConfig.api_url, undefined, activeConfig.id);
    if (fetchModelsResponse.status === 'success') {
      remoteStatus = 'success';
      message = fetchModelsResponse.data?.models?.length
        ? `已检测到 ${fetchModelsResponse.data.models.length} 个可用模型`
        : 'AI 接口连通正常';
    } else {
      const testResponse = await testLlmConnection(activeConfig.id);
      remoteStatus = testResponse.data?.status || (testResponse.status === 'success' ? 'success' : 'error');
      message = testResponse.message || fetchModelsResponse.message;
    }

    const state: AiStatusState =
      remoteStatus === 'success' ? 'online' :
      remoteStatus === 'warning' ? 'warning' :
      'offline';

    aiStatus.value = {
      state,
      configName: activeConfig.config_name,
      modelName: activeConfig.name,
      message: message || (state === 'online' ? 'AI 接口连接正常' : 'AI 接口连接异常')
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 接口连接异常';
    aiStatus.value = {
      state: 'offline',
      configName: '',
      modelName: '',
      message
    };
  } finally {
    aiStatusRefreshInFlight = false;
    scheduleAiStatusRefresh();
  }
};

const handleWindowFocus = () => {
  if (authStore.isAuthenticated && authStore.isApproved) {
    void projectStore.fetchProjects();
  }
  void refreshAiStatus({ silent: true });
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    if (authStore.isAuthenticated && authStore.isApproved) {
      void projectStore.fetchProjects();
    }
    void refreshAiStatus({ silent: true });
  }
};

// 用户信息
const user = computed(() => authStore.currentUser);
const isApproved = computed(() => authStore.isApproved);
const username = computed(() => user.value?.username || '');
const displayName = computed(() => user.value?.real_name || user.value?.username || '');
const avatarLabel = computed(() => `${displayName.value || username.value || '用户'}头像`);
const uploadedAvatarUrl = computed(() => (user.value?.avatar_url || '').trim());
const avatarImageFailed = ref(false);

const avatarText = computed(() => {
  const label = (user.value?.real_name || displayName.value || username.value || '用户').trim();
  if (!label) {
    return '用';
  }
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  return Array.from(label).slice(0, 2).join('').toUpperCase();
});

watch(uploadedAvatarUrl, () => {
  avatarImageFailed.value = false;
});

const themeButtonLabel = computed(() => (themeStore.isBlack ? '切换到默认主题' : '切换到黑色主题'));
type MenuNavigationTarget = {
  route: RouteLocationRaw;
  requiresProject?: boolean;
};

const menuNavigationMap: Record<string, MenuNavigationTarget> = {
  dashboard: { route: '/dashboard' },
  projects: { route: '/projects' },
  requirements: { route: '/requirements', requiresProject: true },
  'api-automation-requests': { route: { path: '/api-automation', query: { tab: 'requests' } }, requiresProject: true },
  'api-automation-test-cases': { route: { path: '/api-automation', query: { tab: 'test-cases' } }, requiresProject: true },
  'api-automation-environments': { route: { path: '/api-automation', query: { tab: 'environments' } }, requiresProject: true },
  'api-automation-execution-records': { route: { path: '/api-automation', query: { tab: 'execution-records' } }, requiresProject: true },
  'api-automation-execution-report': { route: { path: '/api-automation', query: { tab: 'execution-report' } }, requiresProject: true },
  'app-automation-overview': { route: { path: '/app-automation', query: { tab: 'overview' } }, requiresProject: true },
  'app-automation-devices': { route: { path: '/app-automation', query: { tab: 'devices' } }, requiresProject: true },
  'app-automation-packages': { route: { path: '/app-automation', query: { tab: 'packages' } }, requiresProject: true },
  'app-automation-elements': { route: { path: '/app-automation', query: { tab: 'elements' } }, requiresProject: true },
  'app-automation-scene-builder': { route: { path: '/app-automation', query: { tab: 'scene-builder' } }, requiresProject: true },
  'app-automation-test-cases': { route: { path: '/app-automation', query: { tab: 'test-cases' } }, requiresProject: true },
  'app-automation-suites': { route: { path: '/app-automation', query: { tab: 'suites' } }, requiresProject: true },
  'app-automation-executions': { route: { path: '/app-automation', query: { tab: 'executions' } }, requiresProject: true },
  'app-automation-scheduled-tasks': { route: { path: '/app-automation', query: { tab: 'scheduled-tasks' } }, requiresProject: true },
  'app-automation-notifications': { route: { path: '/app-automation', query: { tab: 'notifications' } }, requiresProject: true },
  'app-automation-reports': { route: { path: '/app-automation', query: { tab: 'reports' } }, requiresProject: true },
  'app-automation-settings': { route: { path: '/app-automation', query: { tab: 'settings' } }, requiresProject: true },
  'ui-automation-pages': { route: { path: '/ui-automation', query: { tab: 'pages' } }, requiresProject: true },
  'ui-automation-page-steps': { route: { path: '/ui-automation', query: { tab: 'page-steps' } }, requiresProject: true },
  'ui-automation-testcases': { route: { path: '/ui-automation', query: { tab: 'testcases' } }, requiresProject: true },
  'ui-automation-ai-intelligent': { route: { path: '/ui-automation', query: { tab: 'ai-intelligent' } }, requiresProject: true },
  'ui-automation-execution-records': { route: { path: '/ui-automation', query: { tab: 'execution-records' } }, requiresProject: true },
  'ui-automation-batch-records': { route: { path: '/ui-automation', query: { tab: 'batch-records' } }, requiresProject: true },
  'ui-automation-public-data': { route: { path: '/ui-automation', query: { tab: 'public-data' } }, requiresProject: true },
  'ui-automation-env-config': { route: { path: '/ui-automation', query: { tab: 'env-config' } }, requiresProject: true },
  'ui-automation-actuators': { route: { path: '/ui-automation', query: { tab: 'actuators' } }, requiresProject: true },
  testcases: { route: '/testcases', requiresProject: true },
  testsuites: { route: '/testsuites', requiresProject: true },
  'test-bugs': { route: '/test-bugs', requiresProject: true },
  'test-executions': { route: '/test-executions', requiresProject: true },
  'langgraph-chat': { route: '/langgraph-chat', requiresProject: true },
  'knowledge-management': { route: '/knowledge-management', requiresProject: true },
  'data-factory-all': { route: '/data-factory' },
  'data-factory-string': { route: { path: '/data-factory', query: { category: 'string' } } },
  'data-factory-encoding': { route: { path: '/data-factory', query: { category: 'encoding' } } },
  'data-factory-random': { route: { path: '/data-factory', query: { category: 'random' } } },
  'data-factory-encryption': { route: { path: '/data-factory', query: { category: 'encryption' } } },
  'data-factory-test-data': { route: { path: '/data-factory', query: { category: 'test_data' } } },
  'data-factory-json': { route: { path: '/data-factory', query: { category: 'json' } } },
  'data-factory-crontab': { route: { path: '/data-factory', query: { category: 'crontab' } } },
  users: { route: '/users' },
  organizations: { route: '/organizations' },
  permissions: { route: '/permissions' },
  'project-deletion-logs': { route: '/project-deletion-logs' },
  'llm-configs': { route: '/llm-configs' },
  'api-keys': { route: '/api-keys' },
  'remote-mcp-configs': { route: '/remote-mcp-configs' },
  skills: { route: '/skills' },
};

const activeMenu = computed(() => {
  const path = route.path;

  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/requirements')) return 'requirements';
  if (path.startsWith('/testsuites')) return 'testsuites';
  if (path.startsWith('/test-bugs')) return 'test-bugs';
  if (path.startsWith('/test-executions')) return 'test-executions';
  if (path.startsWith('/testcases')) return 'testcases';
  if (path.startsWith('/users')) return 'users';
  if (path.startsWith('/organizations')) return 'organizations';
  if (path.startsWith('/permissions')) return 'permissions';
  if (path.startsWith('/project-deletion-logs')) return 'project-deletion-logs';
  if (path.startsWith('/llm-configs')) return 'llm-configs';
  if (path.startsWith('/langgraph-chat')) return 'langgraph-chat';
  if (path.startsWith('/knowledge-management')) return 'knowledge-management';
  if (path.startsWith('/data-factory')) {
    const category = String(route.query.category || 'all');
    if (category === 'string') return 'data-factory-string';
    if (category === 'encoding') return 'data-factory-encoding';
    if (category === 'random') return 'data-factory-random';
    if (category === 'encryption') return 'data-factory-encryption';
    if (category === 'test_data') return 'data-factory-test-data';
    if (category === 'json') return 'data-factory-json';
    if (category === 'crontab') return 'data-factory-crontab';
    return 'data-factory-all';
  }
  if (path.startsWith('/api-keys')) return 'api-keys';
  if (path.startsWith('/remote-mcp-configs')) return 'remote-mcp-configs';
  if (path.startsWith('/skills')) return 'skills';
  if (path.startsWith('/api-automation')) {
    const tab = String(route.query.tab || 'requests');
    if (tab === 'test-cases') return 'api-automation-test-cases';
    if (tab === 'environments') return 'api-automation-environments';
    if (tab === 'execution-records') return 'api-automation-execution-records';
    if (tab === 'execution-report') return 'api-automation-execution-report';
    return 'api-automation-requests';
  }
  if (path.startsWith('/app-automation')) {
    const tab = String(route.query.tab || 'overview');
    if (tab === 'devices') return 'app-automation-devices';
    if (tab === 'packages') return 'app-automation-packages';
    if (tab === 'elements') return 'app-automation-elements';
    if (tab === 'scene-builder') return 'app-automation-scene-builder';
    if (tab === 'test-cases') return 'app-automation-test-cases';
    if (tab === 'suites') return 'app-automation-suites';
    if (tab === 'executions') return 'app-automation-executions';
    if (tab === 'scheduled-tasks') return 'app-automation-scheduled-tasks';
    if (tab === 'notifications') return 'app-automation-notifications';
    if (tab === 'reports') return 'app-automation-reports';
    if (tab === 'settings') return 'app-automation-settings';
    return 'app-automation-overview';
  }
  if (path.startsWith('/ui-automation/trace')) return 'ui-automation-execution-records';
  if (path.startsWith('/ui-automation')) {
    const tab = String(route.query.tab || 'pages');
    if (tab === 'page-steps') return 'ui-automation-page-steps';
    if (tab === 'testcases') return 'ui-automation-testcases';
    if (tab === 'ai-intelligent') return 'ui-automation-ai-intelligent';
    if (tab === 'execution-records') return 'ui-automation-execution-records';
    if (tab === 'batch-records') return 'ui-automation-batch-records';
    if (tab === 'public-data') return 'ui-automation-public-data';
    if (tab === 'env-config') return 'ui-automation-env-config';
    if (tab === 'actuators') return 'ui-automation-actuators';
    return 'ui-automation-pages';
  }

  return '';
});

const activeGroupKey = computed(() => {
  if (activeMenu.value.startsWith('api-automation-')) return 'api-automation';
  if (activeMenu.value.startsWith('app-automation-')) return 'app-automation';
  if (activeMenu.value.startsWith('ui-automation-')) return 'ui-automation';
  if (activeMenu.value.startsWith('data-factory-')) return 'data-factory';
  if (['testcases', 'testsuites', 'test-bugs', 'test-executions'].includes(activeMenu.value)) return 'test-management';
  if (['users', 'organizations', 'permissions', 'project-deletion-logs', 'llm-configs', 'api-keys', 'remote-mcp-configs', 'skills'].includes(activeMenu.value)) {
    return 'settings';
  }
  return '';
});

type PageMeta = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

const pageMetaMap: Record<string, PageMeta> = {
  dashboard: { eyebrow: 'OVERVIEW', title: '工作台', subtitle: '项目健康、测试进度与 AI 运行状态总览' },
  projects: { eyebrow: 'PROJECTS', title: '项目管理', subtitle: '管理项目空间、成员与测试资产' },
  requirements: { eyebrow: 'REQUIREMENTS', title: '需求管理', subtitle: '汇总需求文档、评审结论与跟踪状态' },
  testcases: { eyebrow: 'TEST MANAGEMENT', title: '测试用例', subtitle: '组织、维护并评审功能测试用例' },
  testsuites: { eyebrow: 'TEST MANAGEMENT', title: '测试套件', subtitle: '按业务域组合用例与执行范围' },
  'test-bugs': { eyebrow: 'TEST MANAGEMENT', title: 'BUG 管理', subtitle: '跟踪缺陷生命周期与修复验证' },
  'test-executions': { eyebrow: 'TEST MANAGEMENT', title: '测试报告', subtitle: '查看执行结果、通过率与趋势' },
  'api-automation-requests': { eyebrow: 'API AUTOMATION', title: '请求管理', subtitle: '维护接口资产、请求定义与环境变量' },
  'api-automation-test-cases': { eyebrow: 'API AUTOMATION', title: '接口测试用例', subtitle: '编排断言、变量与前后置脚本' },
  'api-automation-environments': { eyebrow: 'API AUTOMATION', title: '环境配置', subtitle: '管理接口运行环境与公共参数' },
  'api-automation-execution-records': { eyebrow: 'API AUTOMATION', title: '接口执行记录', subtitle: '追踪每次执行的请求明细与结果' },
  'api-automation-execution-report': { eyebrow: 'API AUTOMATION', title: '接口测试报告', subtitle: '汇总用例通过率、耗时与失败原因' },
  'ui-automation-pages': { eyebrow: 'UI AUTOMATION', title: '页面管理', subtitle: '沉淀页面对象与可复用的定位信息' },
  'ui-automation-page-steps': { eyebrow: 'UI AUTOMATION', title: '页面步骤', subtitle: '组织页面操作步骤与原子动作' },
  'ui-automation-testcases': { eyebrow: 'UI AUTOMATION', title: 'UI 测试用例', subtitle: '组合步骤形成可执行的 UI 场景' },
  'ui-automation-ai-intelligent': { eyebrow: 'UI AUTOMATION', title: 'AI 智能模式', subtitle: '用自然语言驱动 Web 自动化执行' },
  'ui-automation-execution-records': { eyebrow: 'UI AUTOMATION', title: 'UI 执行记录', subtitle: '查看执行轨迹、截图与回放信息' },
  'ui-automation-batch-records': { eyebrow: 'UI AUTOMATION', title: '批量执行', subtitle: '批量调度用例并跟踪运行进度' },
  'ui-automation-public-data': { eyebrow: 'UI AUTOMATION', title: '公共数据', subtitle: '维护跨用例共享的数据集与变量' },
  'ui-automation-env-config': { eyebrow: 'UI AUTOMATION', title: 'UI 环境配置', subtitle: '配置浏览器、地址与运行参数' },
  'ui-automation-actuators': { eyebrow: 'UI AUTOMATION', title: '执行器', subtitle: '管理 UI 自动化执行节点与状态' },
  'app-automation-overview': { eyebrow: 'APP AUTOMATION', title: 'APP 自动化概览', subtitle: '掌握设备、用例与执行运行态势' },
  'app-automation-devices': { eyebrow: 'APP AUTOMATION', title: '设备管理', subtitle: '纳管真机与模拟器并查看连接状态' },
  'app-automation-packages': { eyebrow: 'APP AUTOMATION', title: '应用包', subtitle: '管理被测 App 安装包与版本' },
  'app-automation-elements': { eyebrow: 'APP AUTOMATION', title: '元素管理', subtitle: '维护页面元素与稳定定位策略' },
  'app-automation-scene-builder': { eyebrow: 'APP AUTOMATION', title: '场景编排', subtitle: '以流程化方式编排移动端场景' },
  'app-automation-test-cases': { eyebrow: 'APP AUTOMATION', title: 'APP 测试用例', subtitle: '管理与调试移动端自动化用例' },
  'app-automation-suites': { eyebrow: 'APP AUTOMATION', title: 'APP 测试套件', subtitle: '按业务范围组织移动端用例集' },
  'app-automation-executions': { eyebrow: 'APP AUTOMATION', title: 'APP 执行记录', subtitle: '追踪设备执行过程与结果' },
  'app-automation-scheduled-tasks': { eyebrow: 'APP AUTOMATION', title: '定时任务', subtitle: '规划自动化任务的周期调度' },
  'app-automation-notifications': { eyebrow: 'APP AUTOMATION', title: '通知日志', subtitle: '查看执行通知的发送与回执' },
  'app-automation-reports': { eyebrow: 'APP AUTOMATION', title: 'APP 执行报告', subtitle: '汇总移动端执行质量与趋势' },
  'app-automation-settings': { eyebrow: 'APP AUTOMATION', title: '环境设置', subtitle: '配置 APP 自动化的运行环境' },
  'langgraph-chat': { eyebrow: 'AI COPILOT', title: 'AI 对话', subtitle: '与测试智能体协作完成分析与生成' },
  'knowledge-management': { eyebrow: 'KNOWLEDGE', title: '知识库管理', subtitle: '管理测试知识、文档与检索语料' },
  'data-factory-all': { eyebrow: 'DATA FACTORY', title: '工具面板', subtitle: '聚合常用测试数据构造工具' },
  'data-factory-string': { eyebrow: 'DATA FACTORY', title: '字符工具', subtitle: '生成、转换与校验文本数据' },
  'data-factory-encoding': { eyebrow: 'DATA FACTORY', title: '编码工具', subtitle: '完成常用编码与解码转换' },
  'data-factory-random': { eyebrow: 'DATA FACTORY', title: '随机工具', subtitle: '构造随机字符串、数字与身份数据' },
  'data-factory-encryption': { eyebrow: 'DATA FACTORY', title: '加密工具', subtitle: '生成摘要与常用加密结果' },
  'data-factory-test-data': { eyebrow: 'DATA FACTORY', title: '测试数据', subtitle: '维护可复用的测试数据集合' },
  'data-factory-json': { eyebrow: 'DATA FACTORY', title: 'JSON 工具', subtitle: '格式化、校验与转换 JSON 数据' },
  'data-factory-crontab': { eyebrow: 'DATA FACTORY', title: 'Crontab 工具', subtitle: '解析并预览定时表达式' },
  users: { eyebrow: 'SYSTEM', title: '用户管理', subtitle: '管理平台账号、角色与访问状态' },
  organizations: { eyebrow: 'SYSTEM', title: '组织管理', subtitle: '维护组织架构与团队归属' },
  permissions: { eyebrow: 'SYSTEM', title: '权限管理', subtitle: '配置角色权限与资源访问边界' },
  'project-deletion-logs': { eyebrow: 'SYSTEM', title: '项目删除记录', subtitle: '审计项目删除操作与历史信息' },
  'llm-configs': { eyebrow: 'SYSTEM', title: 'AI 大模型配置', subtitle: '接入并管理智能测试所需模型' },
  'api-keys': { eyebrow: 'SYSTEM', title: 'API KEY 管理', subtitle: '管理开放接口凭据与调用范围' },
  'remote-mcp-configs': { eyebrow: 'SYSTEM', title: 'MCP 配置', subtitle: '连接外部 MCP 服务与工具能力' },
  skills: { eyebrow: 'SYSTEM', title: 'Skills 管理', subtitle: '维护智能体可调用的技能集合' },
  'personal-center': { eyebrow: 'ACCOUNT', title: '个人中心', subtitle: '维护个人信息、头像与安全设置' },
  'testcase-templates': { eyebrow: 'TEMPLATES', title: '模板管理', subtitle: '维护可复用的测试用例模板' },
};

const pageMeta = computed<PageMeta>(() => {
  if (route.path.startsWith('/personal-center')) {
    return pageMetaMap['personal-center'];
  }

  return pageMetaMap[activeMenu.value] || {
    eyebrow: 'FEICE WORKSPACE',
    title: 'FeiCe 飞测',
    subtitle: 'AI 驱动的一体化测试工作台',
  };
});

const openKeys = ref<string[]>([]);
const { collapsed, isMobile, mobileNavOpen, navigationRef, toggleNavigation, closeNavigation } = useWorkspaceNavigation();
const isWorkspacePage = computed(() => ['/testcases', '/testsuites', '/test-bugs', '/api-automation', '/ui-automation', '/ai-diagram'].includes(route.path));
watch(() => route.fullPath, closeNavigation);
const hasProjectAccess = computed(() => projectStore.projectList.length > 0);

const hasProjectsPermission = computed(() => {
  return authStore.hasPermission('projects.view_project') || hasProjectAccess.value;
});

const hasRequirementsPermission = computed(() => {
  return authStore.hasPermission('requirements.view_requirementdocument') || hasProjectAccess.value;
});

const hasTestcasesPermission = computed(() => {
  return authStore.hasPermission('testcases.view_testcase') || hasProjectAccess.value;
});

const hasTestSuitesPermission = computed(() => {
  return authStore.hasPermission('testcases.view_testsuite') || hasProjectAccess.value;
});

const hasTestBugsPermission = computed(() => {
  return authStore.hasPermission('testcases.view_testsuite') || hasProjectAccess.value;
});

const hasTestExecutionsPermission = computed(() => {
  return authStore.hasPermission('testcases.view_testexecution') || hasProjectAccess.value;
});

const hasLangGraphChatPermission = computed(() => {
  return authStore.hasPermission('langgraph_integration.view_llmconfig') ||
         authStore.hasPermission('langgraph_integration.view_chatsession') ||
         authStore.hasPermission('langgraph_integration.view_chatmessage') ||
         hasProjectAccess.value;
});

const hasApiAutomationRequestsPermission = computed(() => {
  return authStore.hasPermission('api_automation.view_apicollection') ||
         authStore.hasPermission('api_automation.view_apirequest') ||
         authStore.hasPermission('api_automation.view_apiimportjob') ||
         hasProjectAccess.value;
});

const hasApiAutomationTestCasesPermission = computed(() => {
  return authStore.hasPermission('api_automation.view_apitestcase') ||
         authStore.hasPermission('api_automation.view_apicasegenerationjob') ||
         hasProjectAccess.value;
});

const hasApiAutomationEnvironmentsPermission = computed(() => {
  return authStore.hasPermission('api_automation.view_apienvironment') || hasProjectAccess.value;
});

const hasApiAutomationExecutionRecordsPermission = computed(() => {
  return authStore.hasPermission('api_automation.view_apiexecutionrecord') || hasProjectAccess.value;
});

const hasApiAutomationExecutionReportPermission = computed(() => {
  return authStore.hasPermission('api_automation.view_apiexecutionreport') ||
         authStore.hasPermission('api_automation.view_apiexecutionrecord') ||
         hasProjectAccess.value;
});

const hasApiAutomationPermission = computed(() => {
  return hasApiAutomationRequestsPermission.value ||
         hasApiAutomationTestCasesPermission.value ||
         hasApiAutomationEnvironmentsPermission.value ||
         hasApiAutomationExecutionRecordsPermission.value ||
         hasApiAutomationExecutionReportPermission.value;
});

const hasApiAutomationMenuItems = computed(() => hasApiAutomationPermission.value);

const hasAppAutomationOverviewPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationoverview') || hasProjectAccess.value);
const hasAppAutomationDevicesPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationdevice') || hasProjectAccess.value);
const hasAppAutomationPackagesPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationpackage') || hasProjectAccess.value);
const hasAppAutomationElementsPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationelement') || hasProjectAccess.value);
const hasAppAutomationSceneBuilderPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationscenebuilder') || hasProjectAccess.value);
const hasAppAutomationTestCasesPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationtestcase') || hasProjectAccess.value);
const hasAppAutomationSuitesPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationsuite') || hasProjectAccess.value);
const hasAppAutomationExecutionsPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationexecution') || hasProjectAccess.value);
const hasAppAutomationScheduledTasksPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationscheduledtask') || hasProjectAccess.value);
const hasAppAutomationNotificationsPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationnotification') || hasProjectAccess.value);
const hasAppAutomationReportsPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationreport') || hasProjectAccess.value);
const hasAppAutomationSettingsPermission = computed(() => authStore.hasPermission('app_automation.view_appautomationsettings') || hasProjectAccess.value);

const hasAppAutomationMenuItems = computed(() => {
  return hasAppAutomationOverviewPermission.value ||
         hasAppAutomationDevicesPermission.value ||
         hasAppAutomationPackagesPermission.value ||
         hasAppAutomationElementsPermission.value ||
         hasAppAutomationSceneBuilderPermission.value ||
         hasAppAutomationTestCasesPermission.value ||
         hasAppAutomationSuitesPermission.value ||
         hasAppAutomationExecutionsPermission.value ||
         hasAppAutomationScheduledTasksPermission.value ||
         hasAppAutomationNotificationsPermission.value ||
         hasAppAutomationReportsPermission.value ||
         hasAppAutomationSettingsPermission.value;
});

const hasUiAutomationPagesPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uimodule') ||
         authStore.hasPermission('ui_automation.view_uipage') ||
         hasProjectAccess.value;
});

const hasUiAutomationPageStepsPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uipagesteps') ||
         authStore.hasPermission('ui_automation.view_uipagestepsdetailed') ||
         hasProjectAccess.value;
});

const hasUiAutomationTestCasesPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uitestcase') ||
         authStore.hasPermission('ui_automation.view_uicasestepsdetailed') ||
         hasProjectAccess.value;
});

const hasUiAutomationAiIntelligentPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uiaicase') ||
         authStore.hasPermission('ui_automation.view_uiaiexecutionrecord') ||
         hasProjectAccess.value;
});

const hasUiAutomationExecutionRecordsPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uiexecutionrecord') || hasProjectAccess.value;
});

const hasUiAutomationBatchRecordsPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uibatchexecutionrecord') || hasProjectAccess.value;
});

const hasUiAutomationPublicDataPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uipublicdata') || hasProjectAccess.value;
});

const hasUiAutomationEnvConfigPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uienvironmentconfig') || hasProjectAccess.value;
});

const hasUiAutomationActuatorsPermission = computed(() => {
  return authStore.hasPermission('ui_automation.view_uiactuator') || hasProjectAccess.value;
});

const hasUiAutomationPermission = computed(() => {
  return hasUiAutomationPagesPermission.value ||
         hasUiAutomationPageStepsPermission.value ||
         hasUiAutomationTestCasesPermission.value ||
         hasUiAutomationAiIntelligentPermission.value ||
         hasUiAutomationExecutionRecordsPermission.value ||
         hasUiAutomationBatchRecordsPermission.value ||
         hasUiAutomationPublicDataPermission.value ||
         hasUiAutomationEnvConfigPermission.value ||
         hasUiAutomationActuatorsPermission.value;
});

const hasUiAutomationMenuItems = computed(() => hasUiAutomationPermission.value);

const hasKnowledgePermission = computed(() => {
  return authStore.hasPermission('knowledge.view_knowledgebase') || hasProjectAccess.value;
});

const hasDataFactoryPermission = computed(() => {
  return authStore.hasPermission('data_factory.view_datafactoryrecord') ||
         authStore.hasPermission('data_factory.view_datafactorytag') ||
         hasProjectAccess.value;
});

const hasDataFactoryMenuItems = computed(() => hasDataFactoryPermission.value);

const hasUsersPermission = computed(() => {
  return authStore.hasPermission('auth.view_user');
});

const hasOrganizationsPermission = computed(() => {
  return authStore.hasPermission('auth.view_group');
});

const hasPermissionsPermission = computed(() => {
  return authStore.hasPermission('auth.view_permission');
});

const hasProjectDeletionLogsPermission = computed(() => {
  return authStore.user?.is_staff || authStore.hasPermission('projects.view_projectdeletionrequest');
});

const hasLlmConfigsPermission = computed(() => {
  return authStore.hasPermission('langgraph_integration.view_llmconfig') ||
         authStore.hasPermission('llm_config.view_llmconfiguration') ||
         authStore.hasPermission('llms.view_llmmodel');
});

const hasApiKeysPermission = computed(() => {
  return authStore.hasPermission('api_keys.view_apikey') ||
         authStore.hasPermission('llms.view_apikey');
});

const hasMcpConfigsPermission = computed(() => {
  return authStore.hasPermission('mcp_tools.view_remotemcpconfig');
});

const hasSkillsPermission = computed(() => {
  return authStore.hasPermission('skills.view_skill');
});

const hasTestManagementMenuItems = computed(() => {
  return hasTestcasesPermission.value ||
         hasTestSuitesPermission.value ||
         hasTestBugsPermission.value ||
         hasTestExecutionsPermission.value;
});

const hasSystemMenuItems = computed(() => {
  return hasUsersPermission.value ||
         hasOrganizationsPermission.value ||
         hasPermissionsPermission.value ||
         hasProjectDeletionLogsPermission.value ||
         hasLlmConfigsPermission.value ||
         hasApiKeysPermission.value ||
         hasMcpConfigsPermission.value ||
         hasSkillsPermission.value;
});

const toggleCollapse = () => {
  toggleNavigation();

  if (!collapsed.value && activeGroupKey.value && !openKeys.value.includes(activeGroupKey.value)) {
    openKeys.value = [...openKeys.value, activeGroupKey.value];
  }
};

const navigateToMenuTarget = (target: MenuNavigationTarget) => {
  if (target.requiresProject && !projectStore.currentProjectId) {
    Message.warning('请先选择或创建项目');
    return;
  }

  void router.push(target.route);
  closeNavigation();
};

const handleMenuItemClick = (key: string) => {
  const target = menuNavigationMap[key];
  if (!target) {
    return;
  }

  navigateToMenuTarget(target);
};

const handleSubMenuClick = (key: string) => {
  if (!collapsed.value) {
    return;
  }

  collapsed.value = false;

  if (!openKeys.value.includes(key)) {
    openKeys.value = [...openKeys.value, key];
  }
};

watch(
  activeGroupKey,
  groupKey => {
    if (collapsed.value || !groupKey || openKeys.value.includes(groupKey)) {
      return;
    }

    openKeys.value = [...openKeys.value, groupKey];
  },
  { immediate: true }
);

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

const handleOpenPersonalCenter = () => {
  router.push('/personal-center');
};

const showProjectSelector = computed(() => isApproved.value);

const selectedProjectId = computed({
  get: () => projectStore.currentProjectId,
  set: (value) => {
    if (value) {
      projectStore.setCurrentProjectById(value);
    }
  }
});

const handleProjectChange = (projectId: number) => {
  projectStore.setCurrentProjectById(projectId);
};

const handlePopupVisibleChange = (visible: boolean) => {
  if (visible) {
    projectStore.fetchProjects();
  }
};

onMounted(async () => {
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  await authStore.bootstrapSession();
  console.log('MainLayout mounted, user:', user.value?.username);
  await projectStore.fetchProjects();
  if (activeGroupKey.value && !openKeys.value.includes(activeGroupKey.value)) {
    openKeys.value = [...openKeys.value, activeGroupKey.value];
  }
  await refreshAiStatus();
});

onUnmounted(() => {
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearAiStatusTimer();
});
</script>
