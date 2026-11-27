// 確かめること(ADR-0011、基本設計書の AUTH-005):
// apikey ヘッダーのないリクエストを、Auth と Data API が拒否するか。
// 利用者のアクセストークンだけを Authorization ヘッダーに付けたリクエストも確かめる。
// 4つとも 401 で拒否されれば、設計どおり。
// 表 spike_rls_notes は、setup.sql で作る。

import { url, testEmail, testPassword, createUser, deleteUser, signIn } from "./common.ts";

const email = testEmail("no-apikey");
const password = testPassword();
const userId = await createUser(email, password);

try {
  const token = await signIn(email, password);
  const cases: { name: string; path: string; init: RequestInit }[] = [
    {
      name: "Auth: パスワードでログインする(鍵なし)",
      path: "/auth/v1/token?grant_type=password",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    },
    {
      name: "Auth: 利用者の情報を読む(アクセストークンだけ)",
      path: "/auth/v1/user",
      init: { headers: { Authorization: `Bearer ${token}` } },
    },
    {
      name: "Data API: 表を読む(鍵なし)",
      path: "/rest/v1/spike_rls_notes?select=*",
      init: {},
    },
    {
      name: "Data API: 表を読む(アクセストークンだけ)",
      path: "/rest/v1/spike_rls_notes?select=*",
      init: { headers: { Authorization: `Bearer ${token}` } },
    },
  ];

  let allRejected = true;
  for (const c of cases) {
    const res = await fetch(url + c.path, c.init);
    if (res.status === 401) {
      console.log(`拒否された: ${c.name} → 401 ${(await res.text()).slice(0, 200)}`);
    } else {
      allRejected = false;
      // 通ったときは、トークンなどが含まれることがあるため、本文は表示しない。
      console.log(`拒否されなかった: ${c.name} → ${res.status}`);
    }
  }
  console.log(allRejected ? "結果: 4つとも拒否された(設計どおり)" : "結果: 拒否されなかったリクエストがある(設計と違う)");
} finally {
  await deleteUser(userId);
}
