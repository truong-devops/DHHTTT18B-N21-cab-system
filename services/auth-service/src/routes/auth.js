const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/errors");
const {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  buildRefreshExpiry,
  ACCESS_TOKEN_EXPIRES_IN,
  verifyAccessToken
} = require("../utils/security");
const {
  createUser,
  findUserByIdentifier,
  findUserById
} = require("../repository/userRepository");
const {
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken
} = require("../repository/tokenRepository");

const router = express.Router();

const DEFAULT_ROLES = (process.env.AUTH_ROLES || "user,admin,driver")
  .split(",")
  .map((role) => role.trim())
  .filter(Boolean);

function validateRole(role) {
  if (!role) {
    return true;
  }
  return DEFAULT_ROLES.includes(role);
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, username, password, role } = req.body || {};
    if (!email && !username) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "email or username is required"
      );
    }
    if (!password || password.length < 6) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "password must be at least 6 characters"
      );
    }
    if (!validateRole(role)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "role is not allowed"
      );
    }

    const existingIdentifier = email || username;
    const existing = await findUserByIdentifier(
      existingIdentifier
    );
    if (existing) {
      throw new ApiError(
        409,
        "CONFLICT",
        "User already exists"
      );
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await createUser({
        email: email || null,
        username: username || null,
        passwordHash,
        role: role || "user",
        status: "active"
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ApiError(
          409,
          "CONFLICT",
          "User already exists"
        );
      }
      throw error;
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role
    });
    const refreshToken = generateRefreshToken();
    await createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: buildRefreshExpiry()
    });

    return res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN
      }
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "identifier and password are required"
      );
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Invalid credentials"
      );
    }
    if (user.status !== "active") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "User is not active"
      );
    }

    const valid = await verifyPassword(
      password,
      user.password_hash
    );
    if (!valid) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Invalid credentials"
      );
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role
    });
    const refreshToken = generateRefreshToken();
    await createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: buildRefreshExpiry()
    });

    return res.json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN
      }
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "refreshToken is required"
      );
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await findRefreshToken(tokenHash);
    if (!stored) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Invalid refresh token"
      );
    }

    const expiredAt = new Date(stored.expired_at);
    if (Number.isNaN(expiredAt.valueOf()) || expiredAt < new Date()) {
      await deleteRefreshToken(tokenHash);
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Refresh token expired"
      );
    }

    const user = await findUserById(stored.user_id);
    if (!user) {
      await deleteRefreshToken(tokenHash);
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "User not found"
      );
    }

    await deleteRefreshToken(tokenHash);

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role
    });
    const nextRefreshToken = generateRefreshToken();
    await createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(nextRefreshToken),
      expiresAt: buildRefreshExpiry()
    });

    return res.json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN
      }
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "refreshToken is required"
      );
    }

    const tokenHash = hashRefreshToken(refreshToken);
    await deleteRefreshToken(tokenHash);
    return res.json({ ok: true });
  })
);

router.get(
  "/verify",
  asyncHandler(async (req, res) => {
    const authHeader = req.header("authorization") || "";
    const [, token] = authHeader.split(" ");
    if (!token) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Missing token"
      );
    }

    try {
      const payload = verifyAccessToken(token);
      return res.json({
        data: {
          userId: payload.sub || payload.id,
          role: payload.role || null,
          roles: Array.isArray(payload.roles)
            ? payload.roles
            : []
        }
      });
    } catch (error) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Invalid token"
      );
    }
  })
);

module.exports = router;
