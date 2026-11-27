// 確かめること(ADR-0011、基本設計書の AUTH-040):
// パブリッシャブルキーと利用者のアクセストークンで Data API を呼ぶと、
// RLS がその利用者として働き、その利用者の行だけが返るか。
// 利用者 A と B の行を1つずつ入れ、A のアクセストークンで読む。A の行だけが返れば、設計どおり。
// 表 spike_rls_notes と、自分の行だけを読める RLS のポリシーは、setup.sql で作る。

import { secretClient, userClient, testEmail, testPassword, createUser, deleteUser, signIn } from "./common.ts";

const password = testPassword();
const emailA = testEmail("rls-a");
const idA = await createUser(emailA, password);
const idB = await createUser(testEmail("rls-b"), password);

try {
  const { error: insertError } = await secretClient()
    .from("spike_rls_notes")
    .insert([
      { owner_id: idA, body: "A の行" },
      { owner_id: idB, body: "B の行" },
    ]);
  if (insertError) throw insertError;

  const token = await signIn(emailA, password);
  const { data, error } = await userClient(token).from("spike_rls_notes").select("owner_id, body");
  if (error) throw error;

  console.log("A のアクセストークンで読んだ行:", data);
  const onlyA = data.length === 1 && data[0].owner_id === idA;
  console.log(onlyA ? "結果: A の行だけが返った(設計どおり)" : "結果: A の行だけではない(設計と違う)");
} finally {
  const { error } = await secretClient().from("spike_rls_notes").delete().in("owner_id", [idA, idB]);
  if (error) console.error("行を削除できなかった:", error.message);
  await deleteUser(idA);
  await deleteUser(idB);
}
