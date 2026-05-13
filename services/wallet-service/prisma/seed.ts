import { seedCategories } from '../src/lib/seed';
import { prisma } from '../src/lib/prisma';

seedCategories()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
