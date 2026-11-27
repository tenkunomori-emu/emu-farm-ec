// 確かめのスクリプトが共通で使う、環境変数の確認と、Supabase のクライアント、アカウントの操作。
// 検証のプロジェクトのほかでは、何もせずに止まる。

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 検証のプロジェクト(supabase/config.toml の [remotes.staging])
const STAGING_URL = "https://gpxqqrzpgcfqstvnxkxo.supabase.co";

export const url = process.env.SUPABASE_URL ?? "";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

if (url !== STAGING_URL) {
  console.error(`SUPABASE_URL に、検証のプロジェクトの URL(${STAGING_URL})を入れてください。`);
  process.exit(1);
}
if (!publishableKey.startsWith("sb_publishable_")) {
  console.error("SUPABASE_PUBLISHABLE_KEY に、パブリッシャブルキー(sb_publishable_ で始まるもの)を入れてください。");
  process.exit(1);
}
if (!secretKey.startsWith("sb_secret_")) {
  console.error("SUPABASE_SECRET_KEY に、シークレットキー(sb_secret_ で始まるもの)を入れてください。");
  process.exit(1);
}

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// シークレットキーのクライアント。Auth の呼び出し(AUTH-001)と、RLS を通らない Data API に使う。
// ログインするとクライアントにセッションが残るため、呼ぶたびに新しく作る。
export function secretClient(): SupabaseClient {
  return createClient(url, secretKey, { auth: noSession });
}

// パブリッシャブルキーと利用者のアクセストークンのクライアント。Data API を、その利用者として呼ぶ(AUTH-040)。
export function userClient(accessToken: string): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function testEmail(purpose: string): string {
  return `spike-${purpose}-${Date.now()}@example.com`;
}

export function testPassword(): string {
  return `${randomUUID()}Aa1!`;
}

// メールの確認を済ませたアカウントを作り、ID を返す。
export async function createUser(email: string, password: string): Promise<string> {
  const { data, error } = await secretClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await secretClient().auth.admin.deleteUser(id);
  if (error) throw error;
}

// パスワードでログインし、アクセストークンを返す。
export async function signIn(email: string, password: string): Promise<string> {
  const { data, error } = await secretClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session.access_token;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
