import type { Category, CategoryType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError } from '../middleware/errorHandler';
import type { CreateCategoryInput } from '../validators/category.validators';

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

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryDTO> {
  try {
    const category = await prisma.category.create({
      data: {
        user_id: userId,
        name: input.name,
        icon: input.icon,
        type: input.type,
      },
    });
    return toDTO(category);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Category already exists');
    }
    throw err;
  }
}
