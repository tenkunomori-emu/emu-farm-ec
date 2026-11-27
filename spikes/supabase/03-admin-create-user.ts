// 確かめること(ADR-0011、基本設計書の AUTH-005、AUTH-020):
// 新規登録を無効にした状態(supabase/config.toml の enable_signup = false)でも、
// シークレットキーで Auth の管理用の API を呼び、アカウントを作れるか。
// 先に、通常の新規登録が拒否されることを確かめる。

import { secretClient, testEmail, testPassword, deleteUser } from "./common.ts";

const password = testPassword();

const signUp = await secretClient().auth.signUp({ email: testEmail("signup"), password });
if (!signUp.error) {
  console.log("新規登録: 拒否されなかった(新規登録が無効になっていない)");
  if (signUp.data.user) await deleteUser(signUp.data.user.id);
  process.exit(1);
}
if (signUp.error.code !== "signup_disabled") {
  console.log(`新規登録: 想定と違う理由で失敗した → ${signUp.error.status} ${signUp.error.code} ${signUp.error.message}`);
  process.exit(1);
}
console.log(`新規登録: 拒否された → ${signUp.error.status} ${signUp.error.code}`);

const { data, error } = await secretClient().auth.admin.createUser({
  email: testEmail("admin-create"),
  password,
  email_confirm: true,
});
if (error) {
  console.log(`結果: 管理用の API でアカウントを作れなかった(設計と違う) → ${error.status} ${error.code} ${error.message}`);
  process.exit(1);
}
console.log("結果: 管理用の API でアカウントを作れた(設計どおり)");
await deleteUser(data.user.id);
