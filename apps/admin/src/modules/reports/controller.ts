// src/controllers/reportController.ts
import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Report } from '@elearning/models';

export const getReports: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const resolved = (req.query.resolved as string) || undefined;
    const qReporterId = req.query.reporterId as string | undefined;
    const qModel = req.query.model as string | undefined;

    const filter: any = {};
    if (resolved === 'true') filter.resolved = true;
    if (resolved === 'false') filter.resolved = false;
    if (qReporterId && mongoose.Types.ObjectId.isValid(qReporterId)) {
      filter['reporter.id'] = qReporterId;
    }
    if (qModel && (qModel === 'User' || qModel === 'Instructor')) {
      filter['reporter.model'] = qModel;
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      success: true,
      meta: { total, totalPages, page, limit },
      data,
    });
  } catch (err) {
    console.error('getReports error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
