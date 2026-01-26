import { PrismaClient, UserRoleEnum } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = ['BUYER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role as UserRoleEnum }, // Cast to UserRoleEnum if imported, otherwise use 'as any'
      update: {},
      create: { name: role as UserRoleEnum },
    });
  }

  console.log('✅ Roles seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
