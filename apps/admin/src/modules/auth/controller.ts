import { Request, Response } from 'express';
import { Admin } from '@elearning/models';
import { IAuthLoginResponse, IAuthLogoutResponse, IAdminResponse, STATUS_MESSAGES } from '@elearning/types';
import { asyncHandler, AppError} from '@elearning/lib';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email });
  if (!admin) throw new AppError('Email or password is incorrect', STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);

  const isMatch = await admin.isPasswordCorrect(password);
  if (!isMatch) throw new AppError('Email or password is incorrect', STATUS_MESSAGES.INVALID_USER_AUTHENTICATION);

  req.login(admin, (err) => {
    if (err) throw new AppError('Authentication failed. Please try again.');
    return res.out<IAuthLoginResponse>({ _id: admin.id, name: admin.name, email: admin.email } as any);
  });
});

export const checkAuth = asyncHandler(async (req: Request, res: Response) => {
  console.log(req.user)
  return res.out(req.user);

});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  req.logout({ keepSessionInfo: false }, (err) => {
    if (err) throw new AppError('Failed. Please try again.');
    return res.out<IAuthLogoutResponse>({});
  });
});
