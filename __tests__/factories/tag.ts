import type { Tag } from '@prisma/client'

let counter = 0

export function mockTag(overrides: Partial<Tag> = {}): Tag {
  counter++
  return {
    id: `cuid_tag_${counter}`,
    name: `Test Tag ${counter}`,
    color: '#6b7a8d',
    ...overrides,
  }
}
