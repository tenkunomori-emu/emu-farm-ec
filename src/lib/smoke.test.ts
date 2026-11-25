import { describe, expect, it } from "vitest";

// Vitest が動き、tsconfig.json の paths(@/*)が使えることを確かめる
import pkg from "@/../package.json";

describe("単体テストの土台", () => {
  it("Vitest が動き、@/ の読み込みが使える", () => {
    expect(pkg.name).toBe("emu-farm-ec");
  });
});
