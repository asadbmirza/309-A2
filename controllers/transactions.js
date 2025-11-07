const { transactionService } = require("../services/transactions");
const { validateService } = require("../services/validate_service");

const createTransaction = async (req, res) => {
  try {
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeysAndType(req.body, {
      utorid: "string",
      type: "string",
      promotionIds: "object",
      remark: "string",
    });

    if (!valid) {
      return res.status(400).json({ error: message });
    }

    const { utorid, type, promotionIds, remark } = parsedData || {};

    if (promotionIds && !Array.isArray(promotionIds)) {
      return res.status(400).json({ error: "Invalid promotionIds" });
    }

    if (type === "purchase") {
      const { spent } = req.body;

      if (typeof spent !== "number" || spent <= 0) {
        return res.status(400).json({ error: "Invalid spent amount" });
      }

      const { data, error } =
        await transactionService.createPurchaseTransaction({
          userId: utorid,
          spent,
          promotionIds,
          type: "purchase",
          description: remark || "",
          cashier: req.userId,
        });

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json(data);
    } else if (type === "adjustment") {
      const { amount, relatedId } = req.body;

      if (typeof amount !== "number") {
        return res.status(400).json({ error: "Invalid amount" });
      }

      if (isNaN(parseInt(relatedId))) {
        return res.status(400).json({ error: "Invalid relatedId" });
      }

      const { data, error } =
        await transactionService.createAdjustmentTransaction({
          userId: utorid,
          amount,
          relatedId,
          description: remark,
          promotionIds: promotionIds,
          cashier: req.userId,
        });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(201).json(data);
    } else {
      return res.status(400).json({ error: "Invalid transaction type" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getTransactions = async (req, res) => {
  try {
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeys(req.query, [
      "name",
      "createdBy",
      "suspicious",
      "promotionId",
      "type",
      "relatedId",
      "amount",
      "operator",
      "page",
      "limit",
    ]);

    if (!valid) {
      return res.status(400).json({ error: message });
    }

    const q = parsedData || {};

    // name: optional string
    if (q.name !== undefined && typeof q.name !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for name; expected string" });
    }

    // createdBy: optional string
    if (q.createdBy !== undefined && typeof q.createdBy !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for createdBy; expected string" });
    }

    // suspicious: optional boolean (accept "true"/"false" strings)
    if (q.suspicious !== undefined) {
      if (typeof q.suspicious === "string") {
        if (q.suspicious === "true") q.suspicious = true;
        else if (q.suspicious === "false") q.suspicious = false;
        else
          return res
            .status(400)
            .json({ error: "Invalid type for suspicious; expected boolean" });
      } else if (typeof q.suspicious !== "boolean") {
        return res
          .status(400)
          .json({ error: "Invalid type for suspicious; expected boolean" });
      }
    }

    // promotionId: optional positive integer
    if (q.promotionId !== undefined) {
      const p = Number(q.promotionId);
      if (Number.isNaN(p) || !Number.isInteger(p) || p <= 0) {
        return res.status(400).json({
          error: "Invalid type for promotionId; expected positive integer",
        });
      }
      q.promotionId = p;
    }

    // type: optional string
    if (q.type !== undefined && typeof q.type !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for type; expected string" });
    }

    // relatedId: optional positive integer
    if (q.relatedId !== undefined) {
      const r = Number(q.relatedId);
      if (Number.isNaN(r) || !Number.isInteger(r) || r <= 0) {
        return res.status(400).json({
          error: "Invalid type for relatedId; expected positive integer",
        });
      }
      q.relatedId = r;
    }

    // amount: optional number
    if (q.amount !== undefined) {
      const a = Number(q.amount);
      if (Number.isNaN(a)) {
        return res
          .status(400)
          .json({ error: "Invalid type for amount; expected number" });
      }
      q.amount = a;
    }

    // operator: optional string
    if (q.operator !== undefined && typeof q.operator !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid type for operator; expected string" });
    }

    // page: optional positive integer
    if (q.page !== undefined) {
      const pg = Number(q.page);
      if (Number.isNaN(pg) || !Number.isInteger(pg) || pg <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid type for page; expected positive integer" });
      }
      q.page = pg;
    }

    // limit: optional positive integer
    if (q.limit !== undefined) {
      const l = Number(q.limit);
      if (Number.isNaN(l) || !Number.isInteger(l) || l <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid type for limit; expected positive integer" });
      }
      q.limit = l;
    }

    if (parsedData.amount && !parsedData.operator) {
      return res
        .status(400)
        .json({ error: "Operator is required when filtering by amount" });
    }

    if (parsedData.relatedId && !parsedData.type) {
      return res
        .status(400)
        .json({ error: "Type is required when filtering by relatedId" });
    }

    if (parsedData.operator && !parsedData.amount) {
      return res
        .status(400)
        .json({ error: "Amount is required when filtering by operator" });
    }

    if (
      parsedData.operator &&
      parsedData.operator !== "gte" &&
      parsedData.operator !== "lte"
    ) {
      return res.status(400).json({ error: "Invalid operator" });
    }

    const { data, error } = await transactionService.getTransactions({
      name: parsedData?.name,
      createdBy: parsedData?.createdBy,
      suspicious: parsedData?.suspicious,
      promotionId: parsedData?.promotionId,
      type: parsedData?.type,
      relatedId: parsedData?.relatedId,
      amount: parsedData?.amount,
      operator: parsedData?.operator,
      page: parsedData?.page || 1,
      limit: parsedData?.limit || 10,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (isNaN(parseInt(transactionId))) {
      return res.status(400).json({ error: "Invalid transactionId" });
    }

    const { data, error } = await transactionService.getTransactionById(
      parseInt(transactionId)
    );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const markTransactionSuspicious = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const {
      valid,
      obj: parsedData,
      message,
    } = validateService.validateObjHasCorrectKeysAndType(req.body, {
      suspicious: "boolean",
    });

    if (isNaN(parseInt(transactionId))) {
      return res.status(400).json({ error: "Invalid transactionId" });
    }

    if (!valid) {
      return res.status(400).json({ error: message });
    }

    const { data, error } =
      await transactionService.updateTransactionSuspicious(
        parseInt(transactionId),
        parsedData.suspicious
      );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const markTransactionProcessed = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { processed } = req.body;

    if (isNaN(parseInt(transactionId))) {
      return res.status(400).json({ error: "Invalid transactionId" });
    }

    if (typeof processed !== "boolean" || processed !== true) {
      return res.status(400).json({ error: "Invalid processed value" });
    }

    const { data, error } = await transactionService.updateTransactionProcessed(
      parseInt(transactionId),
      req.userId
    );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  markTransactionSuspicious,
  markTransactionProcessed,
};
