"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReports = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("@elearning/models");
const getReports = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
        const resolved = req.query.resolved || undefined;
        const qReporterId = req.query.reporterId;
        const qModel = req.query.model;
        const filter = {};
        if (resolved === 'true')
            filter.resolved = true;
        if (resolved === 'false')
            filter.resolved = false;
        if (qReporterId && mongoose_1.default.Types.ObjectId.isValid(qReporterId)) {
            filter['reporter.id'] = qReporterId;
        }
        if (qModel && (qModel === 'User' || qModel === 'Instructor')) {
            filter['reporter.model'] = qModel;
        }
        const skip = (page - 1) * limit;
        const [total, data] = await Promise.all([
            models_1.Report.countDocuments(filter),
            models_1.Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        res.json({
            success: true,
            meta: { total, totalPages, page, limit },
            data,
        });
    }
    catch (err) {
        console.error('getReports error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getReports = getReports;
