const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PromotionService {

    async createPromotion(promotionData) {
        const { name, description, type, startTime, endTime, minSpending, rate, points } = promotionData;

        const promotion = await prisma.promotion.create({
            data: {
                name,
                description,
                type: type === 'one-time' ? 'onetime' : 'automatic',
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                minSpending: minSpending || null,
                rate: rate || null,
                points: points || null
            }
        });

        return promotion;
    }

    async getPromotions(filters, userRole, userId) {
        const { name, type, started, ended, page = 1, limit = 10 } = filters;

        const where = {};
        const now = new Date();

        if (name) {
            where.name = { contains: name};
        }
        if (type) {
            where.type = type === 'one-time' ? 'onetime' : 'automatic';
        }
        
        if (userRole === 'regular') {
            where.startTime = { lte: now };
            where.endTime = { gte: now };

            const usedPromotions = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    promotions: {
                        select: { id: true }
                    }
                }
            });

            const usedIds = usedPromotions?.promotions.map(promo => promo.id) || [];
            if (usedIds.length > 0) {
                where.id = { notIn: usedIds };
            }
        } else {
            if (started === 'true') {
                where.startTime = { lte: now };
            } else if (started === 'false') {
                where.startTime = { gt: now };
            }

            if (ended === 'true') {
                where.endTime = { lt: now };
            } else if (ended === 'false') {
                where.endTime = { gte: now };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [count, promotions] = await Promise.all([
            prisma.promotion.count({ where }),
            prisma.promotion.findMany({
                where,
                skip,
                take,
            })
        ]);

        return { count, promotions };
    }

    async getPromotion(promotionId) {
        const promotion = await prisma.promotion.findUnique({
            where: { id: parseInt(promotionId) }
        });
        return promotion;
    }

    async updatePromotion(promotionId, updates) {
        const updateData = {};

        if (updates.name) updateData.name = updates.name;
        if (updates.description) updateData.description = updates.description;
        if (updates.type) updateData.type = updates.type === 'one-time' ? 'onetime' : 'automatic';
        if (updates.startTime) updateData.startTime = new Date(updates.startTime);
        if (updates.endTime) updateData.endTime = new Date(updates.endTime);
        if (updates.minSpending !== undefined) updateData.minSpending = updates.minSpending;
        if (updates.rate !== undefined) updateData.rate = updates.rate;
        if (updates.points !== undefined) updateData.points = updates.points;

        const updatedPromotion = await prisma.promotion.update({
            where: { id: parseInt(promotionId) },
            data: updateData
        });

        return updatedPromotion;
    }

    async deletePromotion(promotionId) {
        await prisma.promotion.delete({
            where: { id: parseInt(promotionId) }
        });
    }


}

module.exports = new PromotionService();
