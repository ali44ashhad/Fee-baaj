"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainController = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("@elearning/types");
const create = async (req, res, Model, callback) => {
    try {
        const doc = await Model.create(req.body);
        if (callback)
            callback(doc);
        else
            return res.out({ _id: doc._id, message: 'Created' }, types_1.STATUS_MESSAGES.CREATED);
    }
    catch (err) {
        console.log('ERR: ', err);
        return res.out({
            message: err.isOperational ? err.message : 'Unexpected error',
        }, types_1.STATUS_MESSAGES.UNEXPECTED_ERROR);
    }
};
const read = async (req, res, Model, callback) => {
    if (!mongoose_1.Types.ObjectId.isValid(req.params.id))
        return res.out({ message: 'Invalid ID' }, types_1.STATUS_MESSAGES.INVALID_URL_PARAMETER);
    const doc = await Model.findById(req.params.id);
    if (!doc)
        return res.out({ message: 'Not found' }, types_1.STATUS_MESSAGES.NO_DATA);
    if (callback)
        callback(doc);
    else
        return res.out(doc);
};
const update = async (req, res, Model, callback) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id))
            return res.out({ message: 'Invalid ID' }, types_1.STATUS_MESSAGES.INVALID_URL_PARAMETER);
        const doc = await Model.updateOne({ _id: req.params.id }, { $set: req.body });
        if (callback)
            callback(doc);
        else
            return res.out({ message: 'Saved' }, types_1.STATUS_MESSAGES.UPDATED);
    }
    catch (err) {
        console.log('ERR: ', err);
        return res.out({
            message: err.isOperational ? err.message : 'Unexpected error',
        }, types_1.STATUS_MESSAGES.UNEXPECTED_ERROR);
    }
};
const remove = async (req, res, Model, callback) => {
    if (!mongoose_1.Types.ObjectId.isValid(req.params.id))
        return res.out({ message: 'Invalid ID' }, types_1.STATUS_MESSAGES.INVALID_URL_PARAMETER);
    const doc = await Model.findOneAndDelete({ _id: req.params.id });
    if (callback)
        callback(doc);
    return res.out({ message: 'Deleted successfully' }, types_1.STATUS_MESSAGES.DELETED);
};
const list = async (req, res, Model, filter, callback) => {
    const count = await Model.countDocuments(filter);
    if (count === 0) {
        return res.out({
            count: 0,
            total: 0,
            perPage: 1,
            currentPage: 1,
            data: [],
        }, types_1.STATUS_MESSAGES.NO_DATA);
    }
    const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
    const currentPage = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
    const skip = (currentPage - 1) * limit > 0 ? (currentPage - 1) * limit : 0;
    const sort = req.query.sort || -1;
    const docs = await Model.find(filter).sort({ createdAt: sort }).limit(limit).skip(skip);
    const out = {
        total: count,
        count: docs.length,
        perPage: limit,
        currentPage: currentPage,
        data: docs,
    };
    if (callback)
        callback(out);
    else
        res.out(out);
};
const listAll = async (req, res, Model, filter, callback) => {
    const docs = await Model.find(filter).limit(500).sort({ createdAt: -1 });
    const out = {
        count: docs.length,
        data: docs,
    };
    if (callback)
        callback(out);
    else
        res.out(out);
};
exports.mainController = {
    create,
    read,
    update,
    remove,
    list,
    listAll,
};
