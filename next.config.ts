import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev が AGENTS.md に書き足すのを止める(作業の手引きは、このリポジトリで書く)
  agentRules: false,
  // データの読み取りは、求めのたびに動かす。使い回すのは、"use cache" と書いたところだけにする
  // (基本設計書の OPS-001)。Next.js の公式の文書のとおり、2つを一緒に設定する
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
