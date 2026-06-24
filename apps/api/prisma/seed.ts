import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@assetx/auth";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email =
    process.env.SUPER_USER_EMAIL ??
    process.env.ADMIN_EMAIL ??
    "admin@assetx.local";
  const password =
    process.env.SUPER_USER_PASSWORD ??
    process.env.ADMIN_PASSWORD ??
    "admin12345";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { globalRole: "super_user" },
    });
    // eslint-disable-next-line no-console
    console.log(`Super user ${email} already exists, promoted if needed.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      globalRole: "super_user",
      identities: {
        create: {
          provider: "local",
          providerSubject: email.toLowerCase(),
          email,
        },
      },
      memberships: {
        create: {
          role: "account_owner",
          account: {
            create: {
              name: "Default",
              slug: "default",
              settings: { create: {} },
            },
          },
        },
      },
    },
  });
  // eslint-disable-next-line no-console
  console.log(`Seeded super user: ${email}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
