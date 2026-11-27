// 確かめること(ADR-0011、基本設計書の AUTH-021):
// Send Email Hook に Postgres の関数を設定すると、Supabase Auth がメールを送らないか。
// 関数がエラーを返したときも、メールを送らないか。
//
// SPIKE_INBOX_EMAIL のアカウントに、パスワードの再設定のメールを頼む。
// Supabase の組み込みのメール送信は、Organization のメンバーのアドレスにだけ送るため、
// SPIKE_INBOX_EMAIL には、Organization のメンバーのメールアドレスを入れる。
//
// 動かし方(README.md の「Send Email Hook」の順に動かす):
//   before: Hook を設定する前に動かす。メールが届くことを、受信箱で確かめる。
//   after:  Hook を設定したあとに動かす。関数が呼ばれ、メールが届かないことを確かめる。
//           続けて、関数がエラーを返す設定にして、もう一度頼む。最後に、アカウントを削除する。
//           アカウントがないときは作る(after を動かし直すときに、before でメールを頼まずに済むため)。
// 関数と、呼ばれた記録の表は、setup.sql で作る。

import { secretClient, testPassword, createUser, deleteUser, sleep } from "./common.ts";

const inbox = process.env.SPIKE_INBOX_EMAIL ?? "";
if (!inbox.includes("@")) {
  console.error("SPIKE_INBOX_EMAIL に、Organization のメンバーのメールアドレスを入れてください。");
  process.exit(1);
}

const phase = process.argv[2];
if (phase !== "before" && phase !== "after") {
  console.error("引数に before か after を付けて動かしてください。");
  process.exit(1);
}

async function findUserId(email: string): Promise<string | undefined> {
  const { data, error } = await secretClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id;
}

// 同じアカウントへのメールは、60秒あけないと頼めないため、待ってから頼む。
async function requestRecovery(label: string): Promise<void> {
  console.log(`${label}: 60秒待ってから、パスワードの再設定のメールを頼みます。`);
  await sleep(61_000);
  const { error } = await secretClient().auth.resetPasswordForEmail(inbox);
  console.log(error ? `${label}: 失敗した → ${error.status} ${error.code} ${error.message}` : `${label}: 成功した`);
}

async function setHookFails(fail: boolean): Promise<void> {
  const { error } = await secretClient().from("spike_email_hook_mode").update({ fail }).eq("id", 1);
  if (error) throw error;
}

// 表は、この確かめのためだけに作るため、すべての記録を表示する。
async function printHookCalls(): Promise<void> {
  const { data, error } = await secretClient()
    .from("spike_email_hook_calls")
    .select("called_at, email_action_type")
    .order("called_at");
  if (error) throw error;
  console.log(`関数が呼ばれた記録(合計): ${data.length} 件`, data);
}

if (phase === "before") {
  if (!(await findUserId(inbox))) await createUser(inbox, testPassword());
  await requestRecovery("Hook なし");
  console.log("受信箱に、パスワードの再設定のメールが届いたことを確かめてください。");
} else {
  const userId = (await findUserId(inbox)) ?? (await createUser(inbox, testPassword()));
  try {
    await setHookFails(false);
    await requestRecovery("Hook あり(関数は成功を返す)");
    await printHookCalls();

    await setHookFails(true);
    await requestRecovery("Hook あり(関数はエラーを返す)");
    await printHookCalls();

    console.log("受信箱に、after で頼んだメールが1通も届いていないことを確かめてください。");
  } finally {
    await setHookFails(false);
    await deleteUser(userId);
  }
}
