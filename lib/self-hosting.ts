const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function isSelfHostedModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_SELF_HOSTED_MODE;
  if (raw != null && raw.trim() !== "") {
    return TRUE_VALUES.has(raw.trim().toLowerCase());
  }
  // 未配置任何 Supabase 数据库时，自部署用户默认开启免登录单机模式
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    return true;
  }
  return false;
}
