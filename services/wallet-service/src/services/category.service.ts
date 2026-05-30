import type { Category, CategoryType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { invalidateUserCategoriesCache } from './internal.service';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.validators';

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
    await invalidateUserCategoriesCache(userId);
    return toDTO(category);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Category already exists');
    }
    throw err;
  }
}

async function loadOwnedCustomCategory(userId: string, id: string): Promise<Category> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError('Category not found');
  if (category.user_id === null) throw new ForbiddenError('Cannot modify predefined category');
  if (category.user_id !== userId) throw new NotFoundError('Category not found');
  return category;
}

export async function updateCategory(
  userId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDTO> {
  await loadOwnedCustomCategory(userId, id);

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
    },
  });
  await invalidateUserCategoriesCache(userId);
  return toDTO(updated);
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  const category = await loadOwnedCustomCategory(userId, id);

  const fallback = await prisma.category.findFirstOrThrow({
    where: { user_id: null, name: 'Otros', type: category.type },
  });

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { category_id: id },
      data: { category_id: fallback.id },
    }),
    prisma.recurringRule.updateMany({
      where: { category_id: id },
      data: { category_id: fallback.id },
    }),
    prisma.category.delete({ where: { id } }),
  ]);
  await invalidateUserCategoriesCache(userId);
}
