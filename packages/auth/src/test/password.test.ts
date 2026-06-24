import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../password.js";

describe("password hashing", () => {
  it("produces an argon2 hash distinct from the plaintext", async () => {
    const hash = await hashPassword("s3cret-pw");
    expect(hash).not.toBe("s3cret-pw");
    expect(hash.startsWith("$argon2")).toBe(true);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});
