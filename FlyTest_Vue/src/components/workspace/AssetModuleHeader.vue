<template>
  <WorkspaceModuleHeader
    title="测试资产"
    description="统一管理用例、套件、缺陷与执行结果"
    :active-key="route.path"
    :tabs="tabs"
  />
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import WorkspaceModuleHeader from "./WorkspaceModuleHeader.vue";
const route = useRoute(),
  auth = useAuthStore(),
  project = useProjectStore();
const definitions = [
  {
    key: "/testcases",
    label: "测试用例",
    permission: "testcases.view_testcase",
  },
  {
    key: "/testsuites",
    label: "测试套件",
    permission: "testcases.view_testsuite",
  },
  {
    key: "/test-bugs",
    label: "缺陷管理",
    permission: "testcases.view_testsuite",
  },
  {
    key: "/testcase-templates",
    label: "用例模板",
    permission: "testcases.view_testcase",
  },
  {
    key: "/test-executions",
    label: "执行报告",
    permission: "testcases.view_testexecution",
  },
];
const tabs = computed(() =>
  definitions
    .filter(
      (tab) =>
        project.projectList.length > 0 || auth.hasPermission(tab.permission),
    )
    .map((tab) => ({ ...tab, to: tab.key })),
);
</script>
