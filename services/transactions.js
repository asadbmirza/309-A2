const { PrismaClient } = require("@prisma/client");
const { validateService } = require("./validate_service");

const prisma = new PrismaClient();

const transactionService = {
  createPurchaseTransaction: async ({
    userId,
    spent,
    description,
    promotionIds = [],
    cashier,
  }) => {
    try {
      let customer = null;
      customer = await prisma.user.findUnique({
        where: { utorid: userId },
        include: { promotions: true },
      });

      cashierUser = await prisma.user.findUnique({
        where: { id: cashier },
      });

      if (!customer) {
        return { data: null, error: new Error("User not found") };
      }

      const now = new Date();

      // base points: 1 point per $0.25 spent i.e. 4 points per dollar
      let pointPromotionRateIncrease = 0;
      const usedPromotions = [];

      // validate promotions
      for (const relatedId of promotionIds) {
        const pid = Number(relatedId);
        if (!Number.isInteger(pid) || pid <= 0) {
          return {
            data: null,
            error: new Error(`Invalid promotion id: ${relatedId}`),
          };
        }

        const promotion = await prisma.promotion.findUnique({
          where: { id: pid },
        });
        if (!promotion) {
          return {
            data: null,
            error: new Error(`Promotion with id ${pid} does not exist`),
          };
        }

        // active window check
        if (now < promotion.startTime || now > promotion.endTime) {
          return {
            data: null,
            error: new Error(`Promotion with id ${pid} is not active`),
          };
        }

        // minSpending check: if not met, skip this promotion
        if (promotion.minSpending !== null && spent < promotion.minSpending) {
          continue;
        }

        // if one-time, ensure not already used by the user
        if (promotion.type === "onetime") {
          if (customer.promotions.some((p) => p.id === pid)) {
            return {
              data: null,
              error: new Error(
                `Promotion with id ${pid} has already been used`
              ),
            };
          } else {
            await prisma.user.update({
              where: { id: customer.id },
              data: {
                promotions: {
                  connect: { id: pid },
                },
              },
            });
          }
        }

        pointPromotionRateIncrease += promotion.rate * 100;
        usedPromotions.push(pid);
      }

      const automaticPromotions = await prisma.promotion.findMany({
        where: {
          type: "automatic",
          startTime: { lte: now },
          endTime: { gte: now },
          minSpending: { lte: spent },
        },
      });

      for (const promo of automaticPromotions) {
        usedPromotions.push(promo.id);
        pointPromotionRateIncrease += promo.rate * 100;
      }

      let earnedPoints = Math.round(spent * (4 + pointPromotionRateIncrease));

      if (cashierUser.suspicious) {
        earnedPoints = 0;
      }

      await prisma.user.update({
        where: { utorid: customer.utorid },
        data: { points: { increment: earnedPoints } },
      });

      const purchase = await prisma.transaction.create({
        data: {
          type: "purchase",
          spent,
          amount: earnedPoints,
          remark: description || null,
          createdById: cashier,
          userId: customer.id,
          promotions: {
            connect: usedPromotions.map((id) => ({ id })),
          },
          processed: true,
        },
        include: {
          createdBy: { select: { utorid: true } },
        },
      });

      const formattedObject = {
        id: purchase.id,
        utorid: customer.utorid,
        type: purchase.type,
        spent: purchase.spent,
        earned: purchase.amount,
        remark: purchase.remark || "",
        promotionIds: usedPromotions,
        createdBy: purchase.createdBy.utorid,
      };

      return { data: formattedObject, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },
  createAdjustmentTransaction: async ({
    userId,
    amount,
    relatedId,
    description,
    promotionIds = [],
    cashier,
  }) => {
    try {
      const customer = await prisma.user.findUnique({
        where: { utorid: userId },
        include: { promotions: true },
      });
      if (!customer) {
        return { data: null, error: new Error("User not found") };
      }

      // validate related transaction exists
      const relatedTx = await prisma.transaction.findUnique({
        where: { id: Number(relatedId) },
      });
      if (!relatedTx) {
        return {
          data: null,
          error: new Error("Related transaction not found"),
        };
      }

      const now = new Date();
      const usedPromotions = [];
      const oneTimeToConnect = [];

      // validate provided promotions (if any)
      for (const pidRaw of promotionIds || []) {
        const pid = Number(pidRaw);
        if (!Number.isInteger(pid) || pid <= 0) {
          return {
            data: null,
            error: new Error(`Invalid promotion id: ${pidRaw}`),
          };
        }

        const promo = await prisma.promotion.findUnique({ where: { id: pid } });
        if (!promo) {
          return {
            data: null,
            error: new Error(`Promotion with id ${pid} does not exist`),
          };
        }

        if (now < promo.startTime || now > promo.endTime) {
          return {
            data: null,
            error: new Error(`Promotion with id ${pid} is not active`),
          };
        }

        if (promo.type === "onetime") {
          if (customer.promotions.some((p) => p.id === pid)) {
            return {
              data: null,
              error: new Error(
                `Promotion with id ${pid} has already been used`
              ),
            };
          }
          oneTimeToConnect.push(pid);
        }

        usedPromotions.push(pid);
      }

      const createOp = prisma.transaction.create({
        data: {
          type: "adjustment",
          amount,
          remark: description || null,
          createdById: cashier,
          userId: customer.id,
          promotions: usedPromotions.length
            ? { connect: usedPromotions.map((id) => ({ id })) }
            : undefined,
          processed: true,
          relatedId: Number(relatedId),
        },
        include: {
          createdBy: { select: { utorid: true } },
          promotions: { select: { id: true } },
        },
      });

      const updatePointsOp = prisma.user.update({
        where: { id: customer.id },
        data: { points: { increment: Number(amount) } },
      });

      const connectOneTimeOp = oneTimeToConnect.length
        ? prisma.user.update({
            where: { id: customer.id },
            data: {
              promotions: { connect: oneTimeToConnect.map((id) => ({ id })) },
            },
          })
        : null;

      const ops = connectOneTimeOp
        ? [createOp, updatePointsOp, connectOneTimeOp]
        : [createOp, updatePointsOp];

      const results = await prisma.$transaction(ops);
      const created = results[0];

      const promotionIdsOut = Array.isArray(created.promotion)
        ? created.promotion.map((p) => p.id)
        : [];
      const formattedObject = {
        id: created.id,
        utorid: customer.utorid,
        amount: created.amount,
        type: created.type,
        relatedId: Number(relatedId),
        remark: created.remark || "",
        promotionIds: promotionIdsOut,
        createdBy: created.createdBy
          ? created.createdBy.utorid
          : created.createdById,
      };

      return { data: formattedObject, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },
  createTransferTransaction: async ({
    senderUtorid,
    recipientId,
    amt,
    remark,
  }) => {
    try {
      const sender = await prisma.user.findUnique({
        where: { utorid: senderUtorid },
      });
      if (!sender) {
        return { data: null, error: new Error("Sender not found") };
      }

      if (!sender.verified) {
        return { data: null, error: new Error("Sender not verified") };
      }

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
      });
      if (!recipient) {
        return { data: null, error: new Error("Recipient not found") };
      }

      if ((sender.points || 0) < amt) {
        return { data: null, error: new Error("Insufficient points") };
      }

      const createSenderTx = prisma.transaction.create({
        data: {
          type: "transfer",
          amount: amt,
          remark: remark || null,
          createdById: sender.id,
          userId: sender.id,
          processed: true,
        },
        include: { createdBy: { select: { utorid: true } } },
      });

      const createRecipientTx = prisma.transaction.create({
        data: {
          type: "transfer",
          amount: amt,
          remark: remark || null,
          createdById: sender.id,
          userId: recipient.id,
          processed: true,
        },
        include: { createdBy: { select: { utorid: true } } },
      });

      const decrementSender = prisma.user.update({
        where: { id: sender.id },
        data: { points: { decrement: amt } },
      });

      const incrementRecipient = prisma.user.update({
        where: { id: recipient.id },
        data: { points: { increment: amt } },
      });

      const results = await prisma.$transaction([
        createSenderTx,
        createRecipientTx,
        decrementSender,
        incrementRecipient,
      ]);

      const createdSender = results[0];

      const formattedSender = {
        id: createdSender.id,
        sender: sender.utorid,
        recipient: recipient.utorid,
        type: createdSender.type,
        sent: createdSender.amount,
        remark: createdSender.remark || "",
        relatedId: recipient.id,
        createdBy: createdSender.createdBy
          ? createdSender.createdBy.utorid
          : createdSender.createdById,
      };

      return {
        data: formattedSender,
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  },
  createRedemptionTransaction: async ({ userId, amount, description }) => {
    try {
      const customer = await prisma.user.findUnique({
        where: { utorid: userId },
      });

      if (!customer.verified) {
        return { data: null, error: new Error("User not verified") };
      }

      if (customer.points < amount) {
        return { data: null, error: new Error("Insufficient points") };
      }

      const redemption = await prisma.transaction.create({
        data: {
          type: "redemption",
          amount,
          remark: description || null,
          createdById: customer.id,
          userId: customer.id,
          processed: false,
        },
        include: { createdBy: { select: { utorid: true } } },
      });

      const formattedObject = {
        id: redemption.id,
        utorid: customer.utorid,
        type: redemption.type,
        processedBy: null,
        amount: redemption.amount,
        remark: redemption.remark || "",
        createdBy: redemption.createdBy.utorid,
      };

      return {
        data: formattedObject,
        error: null,
      };
    } catch (error) {
      return { data: null, error: error };
    }
  },
  getTransactions: async ({
    name,
    createdBy,
    suspicious,
    promotionId,
    type,
    relatedId,
    amount,
    operator,
    page = 1,
    limit = 10,
  }) => {
    try {
      const where = {};

      if (suspicious !== undefined) {
        where.suspicious = suspicious;
      }

      if (promotionId !== undefined) {
        // Transaction <-> Promotion is a many-to-many relation named `promotion` on Transaction
        where.promotion = { some: { id: Number(promotionId) } };
      }

      if (type !== undefined) {
        where.type = type;
      }

      // relatedId must be used with type and is interpreted depending on type
      if (relatedId !== undefined) {
        if (!type) {
          return {
            data: null,
            error: new Error("relatedId must be used together with type"),
          };
        }

        const rid = Number(relatedId);
        if (!Number.isInteger(rid)) {
          return { data: null, error: new Error("Invalid relatedId") };
        }

        // Interpret relatedId per transaction type
        if (type === "event") {
          where.eventId = rid;
        } else if (type === "redemption") {
          // For redemption, relatedId is cashier user id who processed it -> createdById
          where.createdById = rid;
        } else if (type === "transfer") {
          // For transfers, relatedId is the other user's id; match either userId or createdById
          where.OR = [{ userId: rid }, { createdById: rid }];
        } else if (type === "adjustment") {
          // Adjustment relatedId refers to a transaction id being adjusted.
          // The schema does not store an explicit related transaction id, so we cannot filter reliably.
          return {
            data: null,
            error: new Error(
              "Filtering by relatedId for 'adjustment' is not supported by the current schema"
            ),
          };
        } else {
          // fallback: try matching common relation fields
          where.OR = [{ userId: rid }, { createdById: rid }, { eventId: rid }];
        }
      }

      // amount filter with operator
      if (amount !== undefined) {
        if (!operator || (operator !== "gte" && operator !== "lte")) {
          return {
            data: null,
            error: new Error(
              "Operator must be 'gte' or 'lte' when amount is provided"
            ),
          };
        }
        where.amount = { [operator]: Number(amount) };
      }

      const include = {
        user: { select: { utorid: true } },
        createdBy: { select: { utorid: true } },
        promotions: { select: { id: true } },
      };

      if (name !== undefined) {
        where.AND = where.AND || [];
        where.AND.push({
          OR: [{ user: { utorid: name } }, { user: { name: name } }],
        });
      }

      if (createdBy !== undefined) {
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { createdBy: { utorid: createdBy } },
            { createdBy: { name: createdBy } },
          ],
        });
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [count, transactions] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          include,
          skip,
          take,
          orderBy: { createdAt: "asc" },
        }),
      ]);

      // map to response shape
      const results = transactions.map((t) => {
        const promotionIds = Array.isArray(t.promotion)
          ? t.promotion.map((p) => p.id)
          : [];
        const utorid = t.user ? t.user.utorid : null;
        const createdByUtorid = t.createdBy ? t.createdBy.utorid : null;
        const related =
          t.eventId ||
          (promotionIds.length ? promotionIds[0] : null) ||
          t.createdById ||
          t.userId ||
          null;
        const obj = {
          id: t.id,
          utorid,
          amount: t.amount,
          type: t.type,
          spent: t.spent,
          promotionIds,
          suspicious: t.suspicious || false,
          remark: t.remark || "",
          createdBy: createdByUtorid,
        };

        if (related) obj.relatedId = related;
        if (t.type === "redemption") obj.redeemed = Math.abs(t.amount || 0);

        return obj;
      });

      return { data: { count, results }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },
  getTransactionById: async (transactionId) => {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: { select: { utorid: true } },
          promotions: { select: { id: true } },
          createdBy: { select: { utorid: true } },
        },
      });

      if (!transaction) {
        return { data: null, error: new Error("Transaction not found") };
      }

      const promotionIds = Array.isArray(transaction.promotion)
        ? transaction.promotion.map((p) => p.id)
        : [];
      const formattedObject = {
        id: transaction.id,
        utorid: transaction.user ? transaction.user.utorid : null,
        type: transaction.type,
        amount: transaction.amount,
        promotionIds,
        suspicious: transaction.suspicious,
        remark: transaction.remark,
        createdBy: transaction.createdBy
          ? transaction.createdBy.utorid
          : transaction.createdById,
      };

      if (transaction.type === "adjustment") {
        formattedObject.relatedId = transaction.relatedId;
      } else if (transaction.type === "purchase") {
        formattedObject.spent = transaction.spent;
      }

      return { data: formattedObject, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  },
  getUserTransactions: async ({
    utorid,
    type,
    relatedId,
    promotionId,
    amount,
    operator,
    page = 1,
    limit = 10,
  }) => {
    try {
      const user = await prisma.user.findUnique({ where: { utorid } });
      if (!user) return { data: null, error: new Error("User not found") };

      const where = { userId: user.id };

      if (type !== undefined) {
        where.type = type;
      }

      if (relatedId !== undefined) {
        if (!type) {
          return {
            data: null,
            error: new Error("relatedId must be used together with type"),
          };
        }
        const rid = Number(relatedId);
        if (!Number.isInteger(rid))
          return { data: null, error: new Error("Invalid relatedId") };

        if (type === "event") {
          where.eventId = rid;
        } else if (type === "redemption") {
          where.createdById = rid;
        } else if (type === "transfer") {
          // relatedId for transfer is the other user's id; match either userId or createdById
          where.OR = [{ userId: rid }, { createdById: rid }];
        } else if (type === "adjustment") {
          return {
            data: null,
            error: new Error(
              "Filtering by relatedId for 'adjustment' is not supported by the current schema"
            ),
          };
        } else {
          where.OR = [{ userId: rid }, { createdById: rid }, { eventId: rid }];
        }
      }

      if (promotionId !== undefined) {
        where.promotion = { some: { id: Number(promotionId) } };
      }

      if (amount !== undefined) {
        if (!operator || (operator !== "gte" && operator !== "lte")) {
          return {
            data: null,
            error: new Error(
              "Operator must be 'gte' or 'lte' when amount is provided"
            ),
          };
        }
        where.amount = { [operator]: Number(amount) };
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const include = {
        createdBy: { select: { utorid: true } },
        promotions: { select: { id: true } },
      };

      const [count, transactions] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          include,
          skip,
          take,
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const results = transactions.map((t) => {
        const promotionIds = Array.isArray(t.promotion)
          ? t.promotion.map((p) => p.id)
          : [];
        const createdByUtorid = t.createdBy ? t.createdBy.utorid : null;
        const obj = {
          id: t.id,
          type: t.type,
          spent: t.spent,
          amount: t.amount,
          promotionIds,
          remark: t.remark || "",
          createdBy: createdByUtorid,
        };

        // Determine relatedId interpretations
        if (t.type === "transfer") {
          // relatedId is the other user's id
          obj.relatedId = t.userId === user.id ? t.createdById : t.userId;
        } else if (t.type === "adjustment") {
          const related = t.eventId || t.createdById || t.userId || null;
          if (related) obj.relatedId = related;
        } else if (t.type === "redemption") {
          if (t.createdById) obj.relatedId = t.createdById;
        } else if (t.eventId) {
          obj.relatedId = t.eventId;
        }

        if (t.type === "redemption") obj.redeemed = Math.abs(t.amount || 0);

        return obj;
      });

      return { data: { count, results }, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  },
  updateTransactionSuspicious: async (transactionId, suspicious) => {
    try {
      let transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          createdBy: { select: { utorid: true } },
        },
      });

      if (!transaction) {
        return { data: null, error: new Error("Transaction not found") };
      }

      const user = await prisma.user.findUnique({
        where: { id: transaction.userId },
      });

      if (transaction.suspicious && !suspicious) {
        transaction = await prisma.transaction.update({
          where: { id: transactionId },
          data: { suspicious: false },
          include: {
            createdBy: { select: { utorid: true } },
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { points: { increment: transaction.amount } },
        });
      } else if (!transaction.suspicious && suspicious) {
        transaction = await prisma.transaction.update({
          where: { id: transactionId },
          data: { suspicious: true },
          include: {
            createdBy: { select: { utorid: true } },
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { points: { decrement: transaction.amount } },
        });
      }

      const promotionIds = Array.isArray(transaction.promotion)
        ? transaction.promotion.map((p) => p.id)
        : [];
      const formattedObject = {
        id: transaction.id,
        utorid: user.utorid,
        type: transaction.type,
        spent: transaction.spent,
        amount: transaction.amount,
        promotionIds,
        suspicious: transaction.suspicious,
        remark: transaction.remark,
        createdBy: transaction.createdBy.utorid,
      };

      return { data: formattedObject, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  },
  updateTransactionProcessed: async (transactionId, processedById) => {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return { data: null, error: new Error("Transaction not found") };
      }

      if (transaction.type !== "redemption") {
        return {
          data: null,
          error: new Error("Only redemption transactions can be processed"),
        };
      }

      if (transaction.processed) {
        return {
          data: null,
          error: new Error("Transaction already processed"),
        };
      }

      await prisma.transaction.update({
        where: { id: transactionId },
        data: { processed: true },
      });

      await prisma.user.update({
        where: { id: transaction.userId },
        data: { points: { decrement: transaction.amount } },
      });

      const promotionIds2 = Array.isArray(transaction.promotion)
        ? transaction.promotion.map((p) => p.id)
        : [];
      const formattedObject = {
        id: transaction.id,
        utorid: transaction.userId,
        type: transaction.type,
        processedBy: processedById,
        redeemed: transaction.amount,
        remark: transaction.remark,
        promotionIds: promotionIds2,
        createdBy: transaction.createdById,
      };

      return { data: formattedObject, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  },
};

module.exports = { transactionService };
