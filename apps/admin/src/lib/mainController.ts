import { Request, Response } from 'express';
import { Default__v, Document, IfAny, Model, ProjectionType, Types } from 'mongoose';
import { STATUS_MESSAGES, IListAllResponse } from '@elearning/types';
import { Require_id } from 'mongoose';

export type FilterType<T> = {
  [K in keyof T]?: T[K] extends string | number | boolean | Date ? T[K] | { $in: T[K][] } : T[K];
};

const create = async <T>(req: Request, res: Response, Model: Model<T>, callback?: (arg0: T) => void) => {
  try {
    const doc = await Model.create(req.body);
    if (callback) callback(doc);
    else return res.out({ _id: doc._id, message: 'Created' }, STATUS_MESSAGES.CREATED);
  } catch (err) {
    console.log('ERR: ', err);
    return res.out(
      {
        message: err.isOperational ? err.message : 'Unexpected error',
      },
      STATUS_MESSAGES.UNEXPECTED_ERROR,
    );
  }
};

const read = async <T>(req: Request, res: Response, Model: Model<T>, callback?: (arg0: T) => void) => {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.out({ message: 'Invalid ID' }, STATUS_MESSAGES.INVALID_URL_PARAMETER);

  const doc = await Model.findById(req.params.id);

  if (!doc) return res.out({ message: 'Not found' }, STATUS_MESSAGES.NO_DATA);

  if (callback) callback(doc);
  else return res.out(doc);
};

const update = async <T>(req: Request, res: Response, Model: Model<T>, callback?: (arg0: T) => void) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id))
      return res.out({ message: 'Invalid ID' }, STATUS_MESSAGES.INVALID_URL_PARAMETER);

    const doc = await Model.updateOne({ _id: req.params.id }, { $set: req.body });

    if (callback) callback(doc as any);
    else return res.out({ message: 'Saved' }, STATUS_MESSAGES.UPDATED);
  } catch (err) {
    console.log('ERR: ', err);
    return res.out(
      {
        message: err.isOperational ? err.message : 'Unexpected error',
      },
      STATUS_MESSAGES.UNEXPECTED_ERROR,
    );
  }
};

const remove = async <T>(
  req: Request,
  res: Response,
  Model: Model<T>,
  callback?: (arg0: IfAny<T, any, Document<unknown, {}, T> & Default__v<Require_id<T>>>) => void,
) => {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.out({ message: 'Invalid ID' }, STATUS_MESSAGES.INVALID_URL_PARAMETER);
  const doc = await Model.findOneAndDelete({ _id: req.params.id });

  if (callback) callback(doc);
  return res.out({ message: 'Deleted successfully' }, STATUS_MESSAGES.DELETED);
};

const list = async <T>(
  req: Request,
  res: Response,
  Model: Model<T>,
  filter?: FilterType<T>,
  callback?: (arg0: IListAllResponse<T>) => void,
) => {
  const count = await Model.countDocuments(filter);
  if (count === 0) {
    return res.out(
      {
        count: 0,
        total: 0,
        perPage: 1,
        currentPage: 1,
        data: [],
      },
      STATUS_MESSAGES.NO_DATA,
    );
  }

  const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;

  const currentPage = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;

  const skip = (currentPage - 1) * limit > 0 ? (currentPage - 1) * limit : 0;

  const sort = (req.query.sort as any) || -1;

  const docs = await Model.find(filter).sort({ createdAt: sort }).limit(limit).skip(skip);

  const out = {
    total: count,
    count: docs.length,
    perPage: limit,
    currentPage: currentPage,
    data: docs,
  };

  if (callback) callback(out);
  else res.out(out);
};

const listAll = async <T>(
  req: Request,
  res: Response,
  Model: Model<T>,
  filter?: IfAny<T, any>,
  callback?: (arg0: IListAllResponse<T>) => void,
) => {
  const docs = await Model.find(filter).limit(500).sort({ createdAt: -1 });

  const out = {
    count: docs.length,
    data: docs,
  };

  if (callback) callback(out);
  else res.out(out);
};

export const mainController = {
  create,
  read,
  update,
  remove,
  list,
  listAll,
};
