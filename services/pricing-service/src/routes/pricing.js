const express = require("express");
const crypto = require("crypto");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/errors");
const { sendSuccess } = require("../utils/response");
const { validateRequest } = require("../middleware/validateRequest");
const {
  haversineKm,
  estimateDurationMin,
  calculateFare,
  round
} = require("../domain/pricingEngine");
const { getRateCard, getCouponDiscount } = require("../repository/rateRepository");
const { saveQuote, getQuote } = require("../repository/quoteRepository");
const { requireAuthOrInternal } = require("../middleware/auth");

const router = express.Router();

const QUOTE_TTL_SEC = Math.max(
  1,
  Number(process.env.QUOTE_TTL_SEC || 300)
);

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function validateLocation(location, field, errors) {
  if (!location || typeof location !== "object") {
    errors.push({ path: `body.${field}`, message: "is required" });
    return;
  }

  const { lat, lng } = location;
  if (!isFiniteNumber(lat)) {
    errors.push({ path: `body.${field}.lat`, message: "must be a number" });
  } else if (lat < -90 || lat > 90) {
    errors.push({
      path: `body.${field}.lat`,
      message: "must be between -90 and 90"
    });
  }

  if (!isFiniteNumber(lng)) {
    errors.push({ path: `body.${field}.lng`, message: "must be a number" });
  } else if (lng < -180 || lng > 180) {
    errors.push({
      path: `body.${field}.lng`,
      message: "must be between -180 and 180"
    });
  }
}

function ensurePickupDiffers(pickup, dropoff, errors) {
  if (!pickup || !dropoff) return;
  if (
    pickup.lat === dropoff.lat &&
    pickup.lng === dropoff.lng
  ) {
    errors.push({
      path: "body.dropoff",
      message: "must be different from pickup"
    });
  }
}

router.use(requireAuthOrInternal);

router.post(
  "/quotes",
  validateRequest({
    bodySchema: {
      required: ["pickup", "dropoff", "serviceType"],
      properties: {
        pickup: { type: "object" },
        dropoff: { type: "object" },
        serviceType: {
          type: "string",
          enum: ["STANDARD", "PREMIUM"]
        },
        couponCode: { type: "string" }
      }
    },
    custom: (req, errors) => {
      validateLocation(req.body?.pickup, "pickup", errors);
      validateLocation(req.body?.dropoff, "dropoff", errors);
      ensurePickupDiffers(req.body?.pickup, req.body?.dropoff, errors);
    }
  }),
  asyncHandler(async (req, res) => {
    const { pickup, dropoff, serviceType, couponCode } = req.body;

    const rateCard = await getRateCard(serviceType);
    if (!rateCard) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Unsupported service type"
      );
    }

    const distanceKm = round(haversineKm(pickup, dropoff), 3);
    const durationMin = round(
      estimateDurationMin(distanceKm, rateCard.averageSpeedKmh),
      2
    );
    const discount = getCouponDiscount(couponCode);
    const { estimatedFare, breakdown } = calculateFare({
      distanceKm,
      durationMin,
      rateCard,
      discount
    });

    const quoteId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + QUOTE_TTL_SEC * 1000
    ).toISOString();

    const record = {
      quoteId,
      serviceType,
      pickup,
      dropoff,
      distanceKm,
      durationMin,
      estimatedFare,
      currency: rateCard.currency || "VND",
      breakdown,
      expiresAt,
      createdAt: new Date().toISOString(),
      rateCard: {
        baseFare: rateCard.baseFare,
        perKmRate: rateCard.perKmRate,
        perMinRate: rateCard.perMinRate,
        surgeMultiplier: rateCard.surgeMultiplier,
        averageSpeedKmh: rateCard.averageSpeedKmh,
        currency: rateCard.currency || "VND"
      },
      discountApplied: discount
    };

    await saveQuote(quoteId, record, QUOTE_TTL_SEC);

    return sendSuccess(
      res,
      req,
      {
        quoteId,
        estimatedFare,
        currency: record.currency,
        distanceKm,
        durationMin,
        breakdown,
        expiresAt
      },
      201
    );
  })
);

router.get(
  "/quotes/:quoteId",
  validateRequest({
    paramsSchema: {
      required: ["quoteId"],
      properties: {
        quoteId: { type: "string" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { quoteId } = req.params;
    const quote = await getQuote(quoteId);

    if (!quote) {
      throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired");
    }

    const expiresAtMs = Date.parse(quote.expiresAt || "");
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired");
    }

    return sendSuccess(res, req, {
      quoteId: quote.quoteId,
      estimatedFare: quote.estimatedFare,
      currency: quote.currency,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      breakdown: quote.breakdown,
      expiresAt: quote.expiresAt
    });
  })
);

router.post(
  "/finalize",
  validateRequest({
    bodySchema: {
      required: ["quoteId"],
      properties: {
        quoteId: { type: "string" },
        actualDistanceKm: { type: "number" },
        actualDurationMin: { type: "number" }
      }
    },
    custom: (req, errors) => {
      const { actualDistanceKm, actualDurationMin } = req.body || {};
      if (
        actualDistanceKm !== undefined &&
        (!Number.isFinite(actualDistanceKm) || actualDistanceKm < 0)
      ) {
        errors.push({
          path: "body.actualDistanceKm",
          message: "must be a positive number"
        });
      }
      if (
        actualDurationMin !== undefined &&
        (!Number.isFinite(actualDurationMin) || actualDurationMin < 0)
      ) {
        errors.push({
          path: "body.actualDurationMin",
          message: "must be a positive number"
        });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { quoteId, actualDistanceKm, actualDurationMin } = req.body;
    const quote = await getQuote(quoteId);

    if (!quote) {
      throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired");
    }

    const expiresAtMs = Date.parse(quote.expiresAt || "");
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired");
    }

    const distanceKm =
      actualDistanceKm !== undefined
        ? actualDistanceKm
        : quote.distanceKm;
    const durationMin =
      actualDurationMin !== undefined
        ? actualDurationMin
        : quote.durationMin;

    const { estimatedFare, breakdown } = calculateFare({
      distanceKm,
      durationMin,
      rateCard: quote.rateCard || {},
      discount: quote.discountApplied
    });

    return sendSuccess(res, req, {
      quoteId: quote.quoteId,
      finalFare: estimatedFare,
      currency: quote.currency,
      distanceKm,
      durationMin,
      breakdown
    });
  })
);

module.exports = router;
