import { describe, it, expect } from "vitest";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";
import { translate } from "../lib/i18n";

describe("i18n catalogs", () => {
  it("nl defines every en key and no extras", () => {
    const enKeys = Object.keys(en).sort();
    const nlKeys = Object.keys(nl).sort();
    expect(nlKeys).toEqual(enKeys);
  });

  it("has no empty translations", () => {
    for (const [k, v] of Object.entries(nl)) {
      expect(v, `nl["${k}"]`).toBeTruthy();
    }
  });
});

describe("translate()", () => {
  it("returns the locale's message", () => {
    expect(translate("en", "common.save")).toBe("Save");
    expect(translate("nl", "common.save")).toBe("Opslaan");
  });

  it("interpolates params", () => {
    expect(translate("en", "modal.share.inWorkspace", { tenant: "Acme" })).toBe(
      "in Acme",
    );
  });

  it("pluralizes on count", () => {
    expect(translate("en", "bundle.assetsCount", { count: 1 })).toBe("1 asset");
    expect(translate("en", "bundle.assetsCount", { count: 3 })).toBe("3 assets");
    expect(translate("nl", "bundle.assetsCount", { count: 1 })).toBe("1 asset");
    expect(translate("nl", "bundle.assetsCount", { count: 3 })).toBe("3 assets");
  });

  it("falls back to the key when missing", () => {
    // @ts-expect-error intentionally unknown key
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });
});
