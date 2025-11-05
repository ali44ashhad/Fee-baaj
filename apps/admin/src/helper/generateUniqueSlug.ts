import slugify from 'slugify';
import {Course } from '@elearning/models';

async function generateUniqueSlug(title: string, courseId?: string): Promise<string> {
  let baseSlug = slugify(title, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await Course.findOne({ slug, _id: { $ne: courseId } });
    if (!existing) break;

    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
}

export default generateUniqueSlug
