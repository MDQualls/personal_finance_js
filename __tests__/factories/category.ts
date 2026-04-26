import type { Category } from '@prisma/client'

let counter = 0

export function mockCategory(overrides: Partial<Category> = {}): Category {
  counter++
  return {
    id: `cuid_category_${counter}`,
    name: `Test Category ${counter}`,
    parentId: null,
    color: '#6b7a8d',
    icon: 'tag',
    isIncome: false,
    isSystem: false,
    isActive: true,
    ...overrides,
  }
}
