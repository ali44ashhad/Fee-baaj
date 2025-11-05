import { Request, Response } from "express";
import { Enrollment, Referral, User, SignupAttempt } from "@elearning/models";
import {
  IAuthLoginResponse,
  IAuthLogoutResponse,
  IUserResponse,
  STATUS_MESSAGES,
} from "@elearning/types";
import { asyncHandler, AppError, PASSWORD_HASH_SALT } from "@elearning/lib";
import bcrypt from "bcryptjs";

// NOTE: we removed sharp/fs/uploadImageToBunny/createImageEntry — media service handles files now.

interface UserPayload {
  name: string;
  pictureId?: string;   // optional: provided by media server
  pictureUrl?: string;  // optional: proxy URL or media url
  identifier: string;
  password: string;
  gender?: string;
  age?: number;
  active?: boolean;
  fingerprint?: string;
  isPWA?: boolean;
  referralSourceCode?: string;
}

function buildAuthResponseFromUser(userDoc: any): IAuthLoginResponse {
  // Build plain response object that matches IAuthLoginResponse.
  // Ensure required fields exist (avoid passing Mongoose document with methods).
  // Adjust to match your IAuthLoginResponse exact fields; below are common fields.
  return {
    id: userDoc.id ?? String(userDoc._id),
    name: userDoc.name ?? "",
    identifier: userDoc.identifier ?? "",
    pictureId: userDoc.pictureId ?? "",
    pictureUrl: userDoc.pictureUrl ?? "",
    active: Boolean(userDoc.active),
    isVerified: Boolean(userDoc.isVerified),
    age: Number(userDoc.age ?? 0),
    gender: userDoc.gender ?? "",
    createdAt: userDoc.createdAt ? new Date(userDoc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: userDoc.updatedAt ? new Date(userDoc.updatedAt).toISOString() : new Date().toISOString(),
    // Add any other required fields of IAuthLoginResponse here (token, roles, etc.)
  } as unknown as IAuthLoginResponse;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  // Throttle signups by IP
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp =
    typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip;

  const recentCount = await SignupAttempt.countDocuments({
    ipAddress: clientIp,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (recentCount >= 3) {
    throw new AppError(
      "Too many accounts created from this IP in the last 24 hours.",
      STATUS_MESSAGES.RATE_LIMIT_EXCEEDED
    );
  }

  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new AppError("Identifier and password are required.", STATUS_MESSAGES.VALIDATION_ERROR);
  }

  const userExist = await User.exists({ identifier });
  if (userExist) {
    throw new AppError("User with this email or phone already exist", STATUS_MESSAGES.VALIDATION_ERROR);
  }

  const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_SALT);

  // Build payload from JSON body — note pictureId/pictureUrl may be present (from media server)
  const {
    name,
    gender,
    age,
    fingerprint,
    isPWA,
    referralSourceCode,
    pictureId,
    pictureUrl,
    active,
  } = req.body as Partial<UserPayload>;

  const payload: any = {
    name,
    identifier,
    password: hashedPassword,
    gender,
    age: age !== undefined ? Number(age) : undefined,
    fingerprint,
    isPWA: Boolean(isPWA),
    active: active !== undefined ? Boolean(active) : false,
  };

  if (pictureId) payload.pictureId = pictureId;
  if (pictureUrl) payload.pictureUrl = pictureUrl;

  const user = await User.create(payload);

  // record signup attempt
  await SignupAttempt.create({ ipAddress: clientIp });

  // handle referral logic (unchanged)
  if (referralSourceCode && isPWA) {
    const enrollment = await Enrollment.findOne({ referralCode: referralSourceCode });
    if (enrollment) {
      const refExists = await Referral.exists({ fingerprint: fingerprint });
      if (!refExists) {
        await Referral.create({
          code: referralSourceCode,
          enrollmentId: enrollment._id,
          fingerprint: fingerprint,
        });
      }
    }
  }

  // Establish session and return typed response
  req.login(user as any, (err: any) => {
    if (err) throw new AppError("Authentication failed. Please try again.", STATUS_MESSAGES.UNEXPECTED_ERROR);

    // IMPORTANT: do NOT pass the Mongoose document directly to the typed response.
    // Convert to plain object and map required fields to IAuthLoginResponse.
    const resp = buildAuthResponseFromUser(user);
    return res.out<IAuthLoginResponse>(resp);
  });
});

export const checkAuth = asyncHandler(async (req: Request, res: Response) => {
  return res.out<IUserResponse>(req.user as IUserResponse);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  const user = await User.findOne({ identifier });
  if (!user) throw new AppError("Email or phone or password is incorrect", STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) throw new AppError("Email or password is incorrect", STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);

  req.login(user as any, (err: any) => {
    if (err) throw new AppError("Authentication failed. Please try again.", STATUS_MESSAGES.UNEXPECTED_ERROR);

    const resp = buildAuthResponseFromUser(user);
    return res.out<IAuthLoginResponse>(resp);
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) throw new AppError("Logout failed", STATUS_MESSAGES.UNEXPECTED_ERROR);
    req.session?.destroy((err2) => {
      if (err2) console.error("Session destroy error:", err2);
      res.clearCookie("connect.sid");
      return res.out<IAuthLogoutResponse>({ message: "Logged out" });
    });
  });
});
