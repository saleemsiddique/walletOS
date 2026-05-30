import type { Category, CategoryType } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type CategoryDTO = {
  id: string;
  name: string;
  icon: string;
  type: CategoryType;
  is_custom: boolean;
};

function toDTO(category: Category): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    type: category.type,
    is_custom: category.user_id !== null,
  };
}

export async function listCategories(
  userId: string,
  type?: CategoryType,
): Promise<{ categories: CategoryDTO[] }> {
  const categories = await prisma.category.findMany({
    where: {
      OR: [{ user_id: null }, { user_id: userId }],
      ...(type !== undefined && { type }),
    },
    orderBy: [{ user_id: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
  });

  return { categories: categories.map(toDTO) };
}
