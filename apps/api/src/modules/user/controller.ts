// src/modules/internal/controller.ts
import { Request, Response } from "express";
import { User } from "@elearning/models";
import {
  IUserProfileUpdateResponse,
  IUserPasswordUpdateResponse,
  STATUS_MESSAGES,
} from "@elearning/types";
import { asyncHandler, AppError, PASSWORD_HASH_SALT } from "@elearning/lib";
import bcrypt from "bcryptjs";

/**
 * Allowed payload for profile updates (only fields handled by User API).
 * Image uploads are handled by the Media Server. If client chooses to submit
 * pictureId/pictureUrl (e.g., after uploading to media server), they are accepted.
 */
interface UpdatePayload {
  name?: string;
  identifier?: string;
  gender?: string;
  age?: number;
  // optional fields if client wants to immediately set them (media server recommended)
  pictureId?: string;
  pictureUrl?: string;
}

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  // 1) Ensure authenticated
  const userId = req.user && (req.user as any)._id;
  if (!userId) {
    throw new AppError("Not authenticated", STATUS_MESSAGES.UNAUTHORIZED);
  }

  // 2) Load existing user
  const existingUser = await User.findById(userId).exec();
  if (!existingUser) {
    throw new AppError("User not found", STATUS_MESSAGES.NOT_FOUND);
  }

  // 3) Build the updates from request body
  const { name, identifier, gender, age, pictureId, pictureUrl } = req.body as UpdatePayload;
  const updates: any = {}; // use any to build dynamic updates cleanly
  if (name !== undefined) updates.name = name;
  if (identifier !== undefined) updates.identifier = identifier;
  if (gender !== undefined) updates.gender = gender;
  if (age !== undefined) updates.age = Number(age);

  // Accept optional pictureId / pictureUrl but do NOT attempt to process files here
  // (media server should be trusted to call webhook; if the client sets these directly,
  // ensure you validate ownership/auth as needed)
  if (pictureId !== undefined) updates.pictureId = pictureId;
  if (pictureUrl !== undefined) updates.pictureUrl = pictureUrl;

  // 4) Apply DB update
  const updatedUser = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).exec();

  // 5) Respond
  // Use your project's response helper `res.out` if present; otherwise respond normally.
  // Here I return the minimal shape to match your current usage.
  return res.out<IUserProfileUpdateResponse>({
    message: "Profile updated successfully",
    // optionally include updated user if you want:
    // data: updatedUser
  });
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, password } = req.body as { currentPassword: string; password: string };

  const userId = req.user && (req.user as any)._id;
  if (!userId) {
    throw new AppError("Not authenticated", STATUS_MESSAGES.UNAUTHORIZED);
  }

  const user = await User.findById(userId).exec();
  if (!user) throw new AppError("User not found", STATUS_MESSAGES.NOT_FOUND);

  const isMatch = await user.isPasswordCorrect(currentPassword);
  if (!isMatch) throw new AppError("Current password is incorrect", STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);

  const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_SALT);

  await User.findByIdAndUpdate(user._id, { $set: { password: hashedPassword } }).exec();

  // If you rely on req.login behavior, keep it; else simply send response.
  // Here I preserve the previous flow but simplified.
  req.login(user, (err) => {
    if (err) throw new AppError("Authentication failed. Please try again.", STATUS_MESSAGES.AUTHORIZED);
    return res.out<IUserPasswordUpdateResponse>({
      message: "Updated successfully",
    });
  });
});
