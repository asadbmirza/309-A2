const PromotionService = require('../services/promotions');

class PromotionController {
    async createPromotion(req, res) {
        try {
            const { name, description, type, startTime, endTime, minSpending, rate, points } = req.body;

            if (!name || !description || !type || !startTime || !endTime) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            if (type !== 'one-time' && type !== 'automatic') {
                return res.status(400).json({ message: "Invalid promotion type" });
            }

            const start = new Date(startTime);
            const end = new Date(endTime);
            const now = new Date();
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ message: "Invalid date format" });
            }
            if (start < now) {
                return res.status(400).json({ message: "Start time must be in the future" });
            }
            if (end <= start) {
                return res.status(400).json({ message: "End time must be after start time" });
            }
            if (minSpending !== null && minSpending !== undefined &&  minSpending <= 0) {
                return res.status(400).json({ message: "Minimum spending must be a positive number" });
            }
            if (rate !== null && rate !== undefined && rate <= 0) {
                return res.status(400).json({ message: "Rate must be a positive number" });
            }
            if (points !== null && points !== undefined) {
                if (!Number.isInteger(points) || points <= 0) {
                    return res.status(400).json({ message: "Points must be a positive integer" });
                }
            }

            const promotion = await PromotionService.createPromotion({
                name,
                description,
                type,
                startTime: start,
                endTime: end,
                minSpending,
                rate,
                points
            });

            res.status(201).json({
                id: promotion.id,
                name: promotion.name,
                description: promotion.description,
                type: promotion.type === 'onetime' ? 'one-time' : 'automatic',
                startTime: promotion.startTime.toISOString(),
                endTime: promotion.endTime.toISOString(),
                minSpending: promotion.minSpending,
                rate: promotion.rate,
                points: promotion.points
            });
        } catch (error) {
            console.error("Error creating promotion:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getPromotions(req, res) {
        try {
            const { started, ended } = req.query;
            const userRole = req.auth?.role || 'regular';
            const userId = req.userId

            if (started !== undefined && ended !== undefined) {
                return res.status(400).json({ message: "Cannot filter by both started and ended" });
            }
            if (req.query.page !== undefined && req.query.page <= 0) {
                return res.status(400).json({ message: "Invalid page number" });
            }
            if (req.query.limit !== undefined && req.query.limit <= 0) {
                return res.status(400).json({ message: "Invalid limit number" });
            }

            const { count, promotions } = await PromotionService.getPromotions(req.query, userRole, userId);

            const results = promotions.map(promo => {
                const result = {
                    id: promo.id,
                    name: promo.name,
                    type: promo.type === 'onetime' ? 'one-time' : 'automatic',
                    endTime: promo.endTime.toISOString(),
                    minSpending: promo.minSpending,
                    rate: promo.rate,
                    points: promo.points
                };
                if (userRole !== 'regular') result.startTime = promo.startTime.toISOString();

                return result;
            });

            res.status(200).json({ count, results });
        } catch (error) {
            console.error("Error retrieving promotions:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getPromotion(req, res) {
        try {
            const { promotionId } = req.params;
            const userRole = req.auth?.role || 'regular';
            if (!promotionId) {
                return res.status(400).json({ message: "promotionId parameter is required" });
            }
            const promotionIdNum = parseInt(promotionId, 10);
            if (isNaN(promotionIdNum)) {
                return res.status(400).json({ error: "Invalid promotionId" });
            }
            const promotion = await PromotionService.getPromotion(promotionIdNum);

            if (!promotion) {
                return res.status(404).json({ message: "Promotion not found" });
            }

            const now = new Date();
            const isActive = promotion.startTime <= now && promotion.endTime >= now;

            if (userRole === 'regular' && !isActive) {
                return res.status(404).json({ message: "Access denied to this promotion" });
            }

            const response = {
                id: promotion.id,
                name: promotion.name,
                description: promotion.description,
                type: promotion.type === 'onetime' ? 'one-time' : 'automatic',
                endTime: promotion.endTime.toISOString(),
                minSpending: promotion.minSpending,
                rate: promotion.rate,
                points: promotion.points
            };

            if (userRole !== 'regular') {
                response.startTime = promotion.startTime.toISOString();
            }

            res.status(200).json(response);
        } catch (error) {
            console.error("Error retrieving promotion:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async updatePromotion(req, res) {
        try {
            const { promotionId } = req.params;
            const updates = req.body;

            if (!promotionId) {
                return res.status(400).json({ message: "promotionId parameter is required" });
            }
            const promotionIdNum = parseInt(promotionId, 10);
            if (isNaN(promotionIdNum)) {
                return res.status(400).json({ error: "Invalid promotionId" });
            }

            const promotion = await PromotionService.getPromotion(promotionIdNum);
            if (!promotion) {
                return res.status(404).json({ message: "Promotion not found" });
            }

            const now = new Date();
            const newStartTime = updates.startTime ? new Date(updates.startTime) : promotion.startTime;
            const newEndTime = updates.endTime ? new Date(updates.endTime) : promotion.endTime;
            if (isNaN(newStartTime.getTime()) || isNaN(newEndTime.getTime())) {
                return res.status(400).json({ message: "Invalid date format" });
            }
            if (newStartTime < now || newEndTime < now) {
                return res.status(400).json({ message: "Start and end times must be in the future" });
            }
            if (newEndTime <= newStartTime) {
                return res.status(400).json({ message: "End time must be after start time" });
            }

            const restrictedFields = ['name', 'description', 'type', 'startTime', 'minSpending', 'rate', 'points'];
            const hasRestrictedUpdate = restrictedFields.some(field => updates[field] !== undefined);

            if (hasRestrictedUpdate && promotion.startTime < now) {
                return res.status(400).json({ message: "Cannot update restricted fields of an active or past promotion" });
            }
            if  (updates.endTime !== undefined && promotion.endTime < now) {
                return res.status(400).json({ message: "Cannot update end time of a past promotion" });
            }
            if (updates.type && updates.type !== 'one-time' && updates.type !== 'automatic') {
                return res.status(400).json({ message: "Invalid promotion type" });
            }
            if (updates.minSpending !== undefined && updates.minSpending !== null && updates.minSpending <= 0) {
                return res.status(400).json({ message: "Minimum spending must be a positive number" });
            }
            if (updates.rate !== undefined && updates.rate !== null && updates.rate <= 0) {
                return res.status(400).json({ message: "Rate must be a positive number" });
            }
            if (updates.points !== undefined && updates.points !== null) {
                if (!Number.isInteger(updates.points) || updates.points <= 0) {
                    return res.status(400).json({ message: "Points must be a positive integer" });
                }
            }

            const updatedPromotion = await PromotionService.updatePromotion(promotionId, updates);

            const response = {
                id: updatedPromotion.id,
                name: updatedPromotion.name,
                type: updatedPromotion.type === 'onetime' ? 'one-time' : 'automatic',
            };

            Object.keys(updates).forEach(key => {
                if (key === 'startTime' && updates.startTime) {
                    response.startTime = updatedPromotion.startTime.toISOString();
                } else if (key === 'endTime' && updates.endTime) {
                    response.endTime = updatedPromotion.endTime.toISOString();
                } else if (['description', 'minSpending', 'rate', 'points'].includes(key) && updates[key] !== undefined) {
                    response[key] = updatedPromotion[key];
                }
            });

            res.status(200).json(response);
        } catch (error) {
            console.error("Error updating promotion:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async deletePromotion(req, res) {
        try {
            const { promotionId } = req.params;
            if (!promotionId) {
                return res.status(400).json({ message: "promotionId parameter is required" });
            }
            const promotionIdNum = parseInt(promotionId, 10);
            if (isNaN(promotionIdNum)) {
                return res.status(400).json({ error: "Invalid promotionId" });
            }
            
            const promotion = await PromotionService.getPromotion(promotionIdNum);
            if (!promotion) {
                return res.status(404).json({ message: "Promotion not found" });
            }

            if (promotion.startTime <= new Date()) {
                return res.status(403).json({ message: "Cannot delete an active or past promotion" });
            }

            await PromotionService.deletePromotion(promotionId);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting promotion:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}

module.exports = new PromotionController();