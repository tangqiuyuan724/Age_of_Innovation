import { describe, it, expect } from "vitest";
import { terrainDistance, terraformToward } from "../../src/aoi/index.ts";

describe("地形轮", () => {
  it("相邻地形距离 1，相同地形距离 0", () => {
    expect(terrainDistance("desert", "plains")).toBe(1);
    expect(terrainDistance("lake", "lake")).toBe(0);
  });

  it("轮子首尾相连：沙漠和荒地相邻", () => {
    expect(terrainDistance("desert", "wasteland")).toBe(1);
  });

  it("走近的那一边，最远是 3", () => {
    expect(terrainDistance("desert", "lake")).toBe(3);
    expect(terrainDistance("desert", "forest")).toBe(3); // 顺着走 4 步，反着走 3 步
  });

  it("距离和方向无关", () => {
    expect(terrainDistance("mountain", "plains")).toBe(terrainDistance("plains", "mountain"));
  });

  it("朝家园地形改造一步", () => {
    expect(terraformToward("lake", "plains", 1)).toBe("swamp");
    expect(terraformToward("wasteland", "plains", 1)).toBe("desert"); // 绕过轮子首尾
  });

  it("铲子多了也只改到家园地形为止", () => {
    expect(terraformToward("swamp", "plains", 3)).toBe("plains");
  });
});