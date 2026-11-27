// 確かめること(ADR-0011、基本設計書の AUTH-034、AUTH-035):
// Auth のアカウントを削除した直後に、同じメールアドレスでアカウントを作れるか。

import { secretClient, testEmail, testPassword, createUser, deleteUser } from "./common.ts";

const email = testEmail("recreate");

const firstId = await createUser(email, testPassword());
await deleteUser(firstId);
console.log("1つ目のアカウントを作り、削除した");

const { data, error } = await secretClient().auth.admin.createUser({
  email,
  password: testPassword(),
  email_confirm: true,
});
if (error) {
  console.log(`結果: 同じメールアドレスで作れなかった(設計と違う) → ${error.status} ${error.code} ${error.message}`);
  process.exit(1);
}
console.log("結果: 削除した直後に、同じメールアドレスで作れた(設計どおり)");
await deleteUser(data.user.id);
