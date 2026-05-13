import { prisma } from './prisma';

const PREDEFINED_CATEGORIES = [
  { name: 'Comida', icon: '🍔', type: 'EXPENSE' as const },
  { name: 'Transporte', icon: '🚗', type: 'EXPENSE' as const },
  { name: 'Ocio', icon: '🎮', type: 'EXPENSE' as const },
  { name: 'Suscripciones', icon: '📱', type: 'EXPENSE' as const },
  { name: 'Compras', icon: '🛍', type: 'EXPENSE' as const },
  { name: 'Salud', icon: '🏥', type: 'EXPENSE' as const },
  { name: 'Casa', icon: '🏠', type: 'EXPENSE' as const },
  { name: 'Educación', icon: '📚', type: 'EXPENSE' as const },
  { name: 'Otros', icon: '···', type: 'EXPENSE' as const },
  { name: 'Nómina', icon: '💰', type: 'INCOME' as const },
  { name: 'Freelance', icon: '💻', type: 'INCOME' as const },
  { name: 'Inversiones', icon: '📈', type: 'INCOME' as const },
  { name: 'Regalos', icon: '🎁', type: 'INCOME' as const },
  { name: 'Otros', icon: '···', type: 'INCOME' as const },
];

export async function seedCategories(): Promise<void> {
  for (const category of PREDEFINED_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { user_id: null, name: category.name, type: category.type },
    });
    if (!existing) {
      await prisma.category.create({
        data: { user_id: null, name: category.name, icon: category.icon, type: category.type },
      });
    }
  }
}
