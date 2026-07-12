import { db } from '@/lib/db';
import { Role } from '@prisma/client';

export class UserRepository {
  public async findByEmail(email: string) {
    return db.user.findUnique({
      where: { email },
      include: { settings: true },
    });
  }

  public async findById(id: string) {
    return db.user.findUnique({
      where: { id },
      include: { settings: true },
    });
  }

  public async createUser(data: { email: string; passwordHash: string; name?: string; role?: Role; id?: string }) {
    return db.user.create({
      data: {
        id: data.id, // Use Supabase user ID if provided, else auto-generate
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role ?? Role.USER,
        settings: {
          create: {}, // Auto-create default settings
        },
      },
    });
  }

  public async getSettings(userId: string) {
    return db.settings.findUnique({
      where: { userId },
    });
  }

  public async updateSettings(userId: string, data: { currencyPref?: string; themePref?: string; googleSheetUrl?: string }) {
    return db.settings.update({
      where: { userId },
      data,
    });
  }

  public async createAuditLog(data: { userId: string; action: string; details?: string; ipAddress?: string }) {
    return db.auditLog.create({
      data,
    });
  }

  public async getAuditLogs(userId: string, limit = 50) {
    return db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const userRepository = new UserRepository();
export default UserRepository;
