import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@assetx/auth";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? "admin@assetx.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Admin ${email} already exists, skipping.`);
    return;
  }

  await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role: "admin" },
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
