from typing import Any

from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone


class LLMConfig(models.Model):
    PROVIDER_CHOICES = [
        ("openai_compatible", "OpenAI 兼容"),
        ("siliconflow", "硅基流动"),
        ("qwen", "Qwen/通义千问"),
    ]
    WIRE_API_CHOICES = [
        ("chat_completions", "OpenAI Chat"),
        ("messages", "Claude Messages"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_llm_configs",
        verbose_name="归属用户",
        help_text="为空时表示系统级共享配置。",
    )
    config_name = models.CharField(max_length=255, verbose_name="配置名称")
    provider = models.CharField(
        max_length=50,
        choices=PROVIDER_CHOICES,
        default="openai_compatible",
        verbose_name="供应商",
    )
    wire_api = models.CharField(
        max_length=32,
        choices=WIRE_API_CHOICES,
        default="chat_completions",
        verbose_name="协议类型",
    )
    name = models.CharField(max_length=255, verbose_name="模型名称")
    api_url = models.URLField(verbose_name="API 地址")
    api_key = models.CharField(max_length=512, blank=True, default="", verbose_name="API Key")
    system_prompt = models.TextField(blank=True, null=True, verbose_name="系统提示词")
    supports_vision = models.BooleanField(default=False, verbose_name="支持视觉")
    context_limit = models.IntegerField(default=128000, verbose_name="上下文限制")
    request_timeout = models.IntegerField(default=120, verbose_name="请求超时(秒)")
    max_retries = models.IntegerField(default=3, verbose_name="最大重试次数")
    enable_summarization = models.BooleanField(default=True, verbose_name="启用上下文摘要")
    enable_hitl = models.BooleanField(default=True, verbose_name="启用人工审批")
    enable_streaming = models.BooleanField(default=True, verbose_name="启用流式输出")
    is_active = models.BooleanField(default=False, verbose_name="是否激活")
    shared_groups = models.ManyToManyField(
        Group,
        blank=True,
        related_name="shared_llm_configs",
        verbose_name="共享组织",
    )
    shared_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="shared_llm_configs",
        verbose_name="共享成员",
    )
    shared_daily_token_limit = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="共享成员每日 Token 限额",
    )
    shared_total_token_limit = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="共享总 Token 限额",
    )
    shared_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="共享有效期",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "LLM 配置"
        verbose_name_plural = "LLM 配置"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "config_name"],
                name="unique_llm_config_name_per_owner",
            )
        ]

    def __str__(self):
        return f"{self.config_name} ({self.name})"

    def save(self, *args, **kwargs):
        if self.is_active:
            queryset = LLMConfig.objects.filter(is_active=True).exclude(pk=self.pk)
            if self.owner_id:
                queryset = queryset.filter(owner_id=self.owner_id)
            else:
                queryset = queryset.filter(owner__isnull=True)
            queryset.update(is_active=False)
        super().save(*args, **kwargs)

    @classmethod
    def visible_to_user_queryset(cls, user):
        if user is None or not getattr(user, "is_authenticated", False):
            return cls.objects.none()
        if getattr(user, "is_superuser", False):
            return cls.objects.all()
        queryset = cls.objects.filter(
            Q(owner=user)
            | Q(shared_users=user)
            | Q(shared_groups__in=user.groups.all())
        ).distinct()
        if getattr(user, "is_staff", False):
            queryset = cls.objects.filter(
                Q(pk__in=queryset.values("pk")) | Q(owner__isnull=True)
            ).distinct()
        return queryset

    def can_manage(self, user) -> bool:
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        if self.owner_id is None and getattr(user, "is_staff", False):
            return True
        return self.owner_id == user.id

    def can_view_sensitive(self, user) -> bool:
        return self.can_manage(user)

    def is_shared_with(self, user) -> bool:
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if self.owner_id == user.id:
            return False
        return (
            self.shared_users.filter(pk=user.pk).exists()
            or self.shared_groups.filter(
                pk__in=user.groups.values_list("pk", flat=True)
            ).exists()
        )

    def get_share_state_for_user(self, user, *, at_time=None):
        at_time = at_time or timezone.now()
        is_shared_access = self.is_shared_with(user)
        expired = bool(
            is_shared_access
            and self.shared_expires_at
            and self.shared_expires_at <= at_time
        )
        return {
            "is_shared_access": is_shared_access,
            "expired": expired,
            "daily_limit": int(self.shared_daily_token_limit or 0),
            "total_limit": int(self.shared_total_token_limit or 0),
            "expires_at": self.shared_expires_at,
        }

    def get_shared_usage_snapshot_for_user(self, user, *, at_time=None):
        at_time = at_time or timezone.now()
        if not self.is_shared_with(user):
            return {"daily_used_tokens": 0, "total_used_tokens": 0}

        today = timezone.localdate(at_time)
        daily_used_tokens = (
            LLMTokenUsage.objects.filter(
                llm_config=self,
                user=user,
                usage_date=today,
                is_shared_access=True,
            ).aggregate(total=Sum("total_tokens")).get("total")
            or 0
        )
        total_used_tokens = (
            LLMTokenUsage.objects.filter(
                llm_config=self,
                is_shared_access=True,
            ).aggregate(total=Sum("total_tokens")).get("total")
            or 0
        )
        return {
            "daily_used_tokens": int(daily_used_tokens or 0),
            "total_used_tokens": int(total_used_tokens or 0),
        }

    def can_user_use(self, user, *, at_time=None) -> bool:
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        if self.owner_id == user.id:
            return True
        if not self.is_shared_with(user):
            return False

        share_state = self.get_share_state_for_user(user, at_time=at_time)
        if share_state["expired"]:
            return False

        usage_snapshot = self.get_shared_usage_snapshot_for_user(user, at_time=at_time)
        if share_state["daily_limit"] and usage_snapshot["daily_used_tokens"] >= share_state["daily_limit"]:
            return False
        if share_state["total_limit"] and usage_snapshot["total_used_tokens"] >= share_state["total_limit"]:
            return False
        return True


class UserLLMConfigPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="llm_config_preference",
        verbose_name="用户",
    )
    active_config = models.ForeignKey(
        LLMConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="preferred_by_users",
        verbose_name="当前激活配置",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "用户 LLM 偏好"
        verbose_name_plural = "用户 LLM 偏好"


def get_user_active_llm_config(user=None):
    if user is not None and getattr(user, "is_authenticated", False):
        visible = LLMConfig.visible_to_user_queryset(user)
        visible_ids = [config.pk for config in visible if config.can_user_use(user)]
        visible = visible.filter(pk__in=visible_ids)

        preference = (
            UserLLMConfigPreference.objects.select_related("active_config")
            .filter(user=user)
            .first()
        )
        if preference and preference.active_config_id and visible.filter(pk=preference.active_config_id).exists():
            return preference.active_config

        owned_default = visible.filter(owner=user, is_active=True).order_by("-updated_at").first()
        if owned_default:
            return owned_default

        shared_default = visible.filter(is_active=True).order_by("-updated_at").first()
        if shared_default:
            return shared_default

        return visible.order_by("-updated_at").first()

    return LLMConfig.objects.filter(is_active=True).first()


def set_user_active_llm_config(user, config: LLMConfig | None):
    if user is None or not getattr(user, "is_authenticated", False):
        raise ValueError("激活配置时必须提供已登录用户。")

    if config is not None and not config.can_user_use(user):
        raise ValueError("当前共享配置已过期，或已达到共享调用限额，暂时无法激活。")

    preference, _ = UserLLMConfigPreference.objects.get_or_create(user=user)
    preference.active_config = config
    preference.save(update_fields=["active_config", "updated_at"])

    if config and config.owner_id == user.id and not config.is_active:
        LLMConfig.objects.filter(owner=user, is_active=True).exclude(pk=config.pk).update(is_active=False)
        config.is_active = True
        config.save(update_fields=["is_active", "updated_at"])

    return preference


class ChatSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="用户")
    session_id = models.CharField(max_length=255, unique=True, verbose_name="会话ID")
    title = models.CharField(max_length=200, verbose_name="对话标题", default="新对话")
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="关联项目",
    )
    prompt = models.ForeignKey(
        "prompts.UserPrompt",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="关联提示词",
    )
    total_input_tokens = models.BigIntegerField(default=0, verbose_name="累计输入 Token")
    total_output_tokens = models.BigIntegerField(default=0, verbose_name="累计输出 Token")
    total_tokens = models.BigIntegerField(default=0, verbose_name="累计总 Token")
    request_count = models.IntegerField(default=0, verbose_name="请求次数")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "对话会话"
        verbose_name_plural = "对话会话"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"


class UserToolApproval(models.Model):
    POLICY_CHOICES = [
        ("always_allow", "始终允许"),
        ("always_reject", "始终拒绝"),
        ("ask_every_time", "每次询问"),
    ]
    SCOPE_CHOICES = [
        ("session", "仅本次会话"),
        ("permanent", "永久生效"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tool_approvals",
        verbose_name="用户",
    )
    tool_name = models.CharField(max_length=100, verbose_name="工具名称")
    policy = models.CharField(max_length=20, choices=POLICY_CHOICES, default="ask_every_time", verbose_name="审批策略")
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default="permanent", verbose_name="生效范围")
    session_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="会话ID")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "用户工具审批偏好"
        verbose_name_plural = "用户工具审批偏好"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "tool_name", "scope", "session_id"],
                name="unique_user_tool_approval",
            )
        ]
        indexes = [models.Index(fields=["user", "tool_name"])]

    def __str__(self):
        return f"{self.user.username} - {self.tool_name}: {self.policy}"


class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, verbose_name="对话会话")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="用户")
    message_id = models.CharField(max_length=255, verbose_name="消息ID")
    role = models.CharField(
        max_length=20,
        verbose_name="角色",
        choices=[("user", "用户"), ("assistant", "助手"), ("system", "系统")],
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "对话消息"
        verbose_name_plural = "对话消息"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.session.title} - {self.role} [{self.created_at}]"


class LLMTokenUsage(models.Model):
    SOURCE_CHOICES = [
        ("langgraph_chat", "AI 对话"),
        ("api_automation", "AI 接口自动化"),
        ("requirements_review", "需求评审"),
        ("ui_automation", "UI 自动化"),
        ("other", "其他"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="llm_token_usages",
        verbose_name="用户",
    )
    llm_config = models.ForeignKey(
        LLMConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="token_usages",
        verbose_name="LLM 配置",
    )
    config_name = models.CharField(max_length=255, blank=True, default="", verbose_name="配置名称快照")
    provider = models.CharField(max_length=50, blank=True, default="", verbose_name="供应商快照")
    model_name = models.CharField(max_length=255, blank=True, default="", verbose_name="模型名称快照")
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default="other", verbose_name="使用来源")
    prompt_tokens = models.BigIntegerField(default=0, verbose_name="输入 Token")
    completion_tokens = models.BigIntegerField(default=0, verbose_name="输出 Token")
    total_tokens = models.BigIntegerField(default=0, verbose_name="总 Token")
    request_count = models.PositiveIntegerField(default=1, verbose_name="请求次数")
    usage_date = models.DateField(default=timezone.localdate, verbose_name="使用日期")
    is_shared_access = models.BooleanField(default=False, verbose_name="是否共享调用")
    session_id = models.CharField(max_length=255, blank=True, default="", verbose_name="会话ID")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="附加元数据")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "LLM Token 使用记录"
        verbose_name_plural = "LLM Token 使用记录"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["usage_date", "user"]),
            models.Index(fields=["usage_date", "llm_config"]),
            models.Index(fields=["source", "usage_date"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.model_name}:{self.total_tokens}"


def record_llm_token_usage(
    *,
    user,
    llm_config: LLMConfig | None,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    source: str,
    request_count: int = 1,
    session_id: str = "",
    metadata: dict | None = None,
):
    if user is None or not getattr(user, "is_authenticated", False):
        return None

    prompt_tokens = int(prompt_tokens or 0)
    completion_tokens = int(completion_tokens or 0)
    total_tokens = int(total_tokens or (prompt_tokens + completion_tokens) or 0)
    if total_tokens <= 0 and prompt_tokens <= 0 and completion_tokens <= 0:
        return None

    llm_config = llm_config if isinstance(llm_config, LLMConfig) else None
    is_shared_access = bool(
        llm_config
        and llm_config.owner_id
        and llm_config.owner_id != user.id
        and llm_config.is_shared_with(user)
    )

    return LLMTokenUsage.objects.create(
        user=user,
        llm_config=llm_config,
        config_name=getattr(llm_config, "config_name", "") or "",
        provider=getattr(llm_config, "provider", "") or "",
        model_name=getattr(llm_config, "name", "") or "",
        source=source if source in dict(LLMTokenUsage.SOURCE_CHOICES) else "other",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        request_count=max(int(request_count or 1), 1),
        usage_date=timezone.localdate(),
        is_shared_access=is_shared_access,
        session_id=session_id or "",
        metadata=metadata or {},
    )


def extract_llm_usage_metrics(response: Any) -> dict[str, int]:
    response_metadata = getattr(response, "response_metadata", {}) or {}
    token_usage = response_metadata.get("token_usage", {}) or {}
    usage_metadata = getattr(response, "usage_metadata", {}) or {}

    prompt_tokens = int(
        token_usage.get("prompt_tokens")
        or usage_metadata.get("input_tokens")
        or 0
    )
    completion_tokens = int(
        token_usage.get("completion_tokens")
        or usage_metadata.get("output_tokens")
        or 0
    )
    total_tokens = int(
        token_usage.get("total_tokens")
        or usage_metadata.get("total_tokens")
        or (prompt_tokens + completion_tokens)
        or 0
    )
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


def attach_llm_usage_context(
    llm: Any,
    *,
    user,
    llm_config: LLMConfig | None,
    source: str,
    session_id: str = "",
    metadata: dict | None = None,
):
    setattr(
        llm,
        "_flytest_usage_context",
        {
            "user": user,
            "llm_config": llm_config,
            "source": source,
            "session_id": session_id,
            "metadata": metadata or {},
        },
    )
    return llm


def record_llm_response_usage(
    llm: Any,
    response: Any,
    *,
    request_count: int = 1,
    metadata: dict | None = None,
):
    usage_context = getattr(llm, "_flytest_usage_context", None) or {}
    user = usage_context.get("user")
    llm_config = usage_context.get("llm_config")
    source = usage_context.get("source")
    if not user or not source:
        return None

    usage_metrics = extract_llm_usage_metrics(response)
    if (
        usage_metrics["prompt_tokens"] <= 0
        and usage_metrics["completion_tokens"] <= 0
        and usage_metrics["total_tokens"] <= 0
    ):
        return None

    merged_metadata = dict(usage_context.get("metadata") or {})
    if metadata:
        merged_metadata.update(metadata)

    return record_llm_token_usage(
        user=user,
        llm_config=llm_config,
        prompt_tokens=usage_metrics["prompt_tokens"],
        completion_tokens=usage_metrics["completion_tokens"],
        total_tokens=usage_metrics["total_tokens"],
        source=source,
        request_count=request_count,
        session_id=usage_context.get("session_id", "") or "",
        metadata=merged_metadata,
    )
