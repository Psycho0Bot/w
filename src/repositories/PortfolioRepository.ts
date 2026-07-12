import { db } from '@/lib/db';
import { AssetCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class PortfolioRepository {
  public async findPortfoliosByUserId(userId: string) {
    return db.portfolio.findMany({
      where: { userId },
      include: {
        assets: {
          include: {
            transactions: true,
          },
        },
        goals: true,
      },
    });
  }

  public async createPortfolio(userId: string, name: string) {
    return db.portfolio.create({
      data: {
        userId,
        name,
      },
    });
  }

  public async addAsset(portfolioId: string, data: {
    ticker: string;
    name: string;
    category: AssetCategory;
    currency?: string;
    quantity: number | Decimal;
    averagePrice: number | Decimal;
  }) {
    return db.asset.create({
      data: {
        portfolioId,
        ticker: data.ticker,
        name: data.name,
        category: data.category,
        currency: data.currency ?? 'INR',
        quantity: data.quantity,
        averagePrice: data.averagePrice,
      },
    });
  }

  public async addTransaction(assetId: string, data: {
    transactionDate: Date;
    type: string;
    quantity: number | Decimal;
    price: number | Decimal;
    fee?: number | Decimal;
    notes?: string;
  }) {
    return db.transaction.create({
      data: {
        assetId,
        transactionDate: data.transactionDate,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        fee: data.fee ?? 0,
        notes: data.notes,
      },
    });
  }

  public async getGoals(portfolioId: string) {
    return db.goal.findMany({
      where: { portfolioId },
    });
  }

  public async addGoal(portfolioId: string, data: { name: string; targetValue: number | Decimal; deadline?: Date }) {
    return db.goal.create({
      data: {
        portfolioId,
        name: data.name,
        targetValue: data.targetValue,
        deadline: data.deadline,
      },
    });
  }
}

export const portfolioRepository = new PortfolioRepository();
export default PortfolioRepository;
