import { seedCategories } from '../lib/seed';
import { prisma } from '../lib/prisma';

describe('seedCategories', () => {
  it('inserts 14 predefined categories with user_id=null', async () => {
    await seedCategories();
    const categories = await prisma.category.findMany({ where: { user_id: null } });
    expect(categories).toHaveLength(14);
  });

  it('is idempotent — running twice does not duplicate', async () => {
    await seedCategories();
    await seedCategories();
    const categories = await prisma.category.findMany({ where: { user_id: null } });
    expect(categories).toHaveLength(14);
  });
});
