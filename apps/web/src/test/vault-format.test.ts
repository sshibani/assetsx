import { describe, expect, it } from "vitest";
import {
  brandAlpha,
  classifyAssetType,
  formatBytes,
  formatDimensions,
  formatStorageLabel,
  relativeTime,
  renditionLabel,
} from "../lib/vault/format";

describe("classifyAssetType", () => {
  it("classifies common image formats as image", () => {
    for (const f of ["jpg", "JPEG", "png", "webp", "gif"]) {
      expect(classifyAssetType(f)).toBe("image");
    }
  });

  it("classifies svg as logo", () => {
    expect(classifyAssetType("svg")).toBe("logo");
  });

  it("classifies pdf/docx as document", () => {
    expect(classifyAssetType("pdf")).toBe("document");
    expect(classifyAssetType("docx")).toBe("document");
  });

  it("defaults unknown formats to document", () => {
    expect(classifyAssetType("xyz")).toBe("document");
  });
});

describe("formatBytes", () => {
  it("formats bytes across units", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-25T12:00:00Z");
  it("handles recent and older timestamps", () => {
    expect(relativeTime("2026-06-25T11:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-06-25T11:56:00Z", now)).toBe("4 minutes ago");
    expect(relativeTime("2026-06-25T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-22T12:00:00Z", now)).toBe("3d ago");
  });
  it("returns dash for invalid input", () => {
    expect(relativeTime("not-a-date", now)).toBe("—");
  });
});

describe("formatDimensions", () => {
  it("formats when both present, null otherwise", () => {
    expect(formatDimensions(1920, 1080)).toBe("1920 × 1080");
    expect(formatDimensions(null, 1080)).toBeNull();
    expect(formatDimensions(1920, null)).toBeNull();
  });
});

describe("brandAlpha", () => {
  it("converts hex to rgba", () => {
    expect(brandAlpha("#343ced", 0.12)).toBe("rgba(52, 60, 237, 0.12)");
    expect(brandAlpha("343ced", 1)).toBe("rgba(52, 60, 237, 1)");
  });
  it("expands shorthand hex", () => {
    expect(brandAlpha("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });
});

describe("renditionLabel", () => {
  it("maps pipeline names to friendly tier labels", () => {
    expect(renditionLabel("original")).toBe("Original");
    expect(renditionLabel("large")).toBe("High");
    expect(renditionLabel("standard")).toBe("Medium");
    expect(renditionLabel("thumb")).toBe("Low");
  });
  it("falls back to the raw name for unknown tiers", () => {
    expect(renditionLabel("custom")).toBe("custom");
  });
});

describe("formatStorageLabel", () => {
  it("formats used / quota in GB", () => {
    const gb = 1024 ** 3;
    expect(formatStorageLabel(64.2 * gb, 100 * gb)).toBe("64.2 / 100 GB");
  });
});
