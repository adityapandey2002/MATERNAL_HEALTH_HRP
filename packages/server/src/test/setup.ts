import { vi } from "vitest";

vi.mock("../db/client", () => ({
  db: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        executeTakeFirstOrThrow: vi.fn().mockRejectedValue(new Error("Not found")),
      })),
      select: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ count: "0" }),
      })),
    })),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          doUpdateSet: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue([]),
          })),
        })),
        returningAll: vi.fn(() => ({
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "test-id" }),
        })),
      })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returningAll: vi.fn(() => ({
            executeTakeFirst: vi.fn().mockResolvedValue({ id: "test-id" }),
          })),
        })),
      })),
    })),
    deleteFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({}),
      })),
    })),
    destroy: vi.fn().mockResolvedValue(undefined),
  },
}));
