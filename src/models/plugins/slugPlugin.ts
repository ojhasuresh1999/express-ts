import { Schema, Document } from 'mongoose';
import slugify from 'slugify';

export interface SlugOptions {
  source: string | string[];
  target?: string;
  separator?: string;
  lowercase?: boolean;
}

/**
 * Mongoose plugin to generate unique slugs
 *
 * Usage:
 * schema.plugin(slugPlugin, { source: 'title' });
 * schema.plugin(slugPlugin, { source: ['firstName', 'lastName'] });
 */
export const slugPlugin = (schema: Schema, options: SlugOptions) => {
  const target = options.target || 'slug';
  const separator = options.separator || '-';
  const lowercase = options.lowercase !== false;

  schema.add({
    [target]: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
  });

  schema.pre('save', async function (this: Document & Record<string, any>) {
    const doc = this;

    // Only generate slug if it's new, or if the source field(s) changed
    // OR if the slug itself doesn't exist yet
    const shouldGenerate =
      doc.isNew ||
      !doc[target] ||
      (Array.isArray(options.source)
        ? options.source.some((field) => doc.isModified(field))
        : doc.isModified(options.source));

    if (!shouldGenerate) {
      return;
    }

    // Generate initial slug string
    let seedString = '';
    if (Array.isArray(options.source)) {
      seedString = options.source
        .map((field) => doc[field])
        .filter((val) => val) // Remove empty/null
        .join(' ');
    } else {
      seedString = doc[options.source] || '';
    }

    if (!seedString) {
      // If source is empty, we can't generate a slug.
      // Depending on requirements, might want to generate random or skip.
      // skipping for now.
      return;
    }

    let slug = slugify(seedString, {
      lower: lowercase,
      replacement: separator,
      strict: true,
      trim: true,
    });

    // Check for uniqueness and resolve collisions
    const model = doc.constructor as any;
    const criteria: Record<string, any> = { [target]: slug };

    // Exclude current document from check if it exists (for updates)
    if (doc._id) {
      criteria._id = { $ne: doc._id };
    }

    let duplicate = await model.findOne(criteria);
    let counter = 1;

    // TODO: Improve performance for many duplicates using regex findOne
    while (duplicate) {
      const newSlug = `${slug}${separator}${counter}`;
      const newCriteria = { ...criteria, [target]: newSlug };
      duplicate = await model.findOne(newCriteria);
      if (!duplicate) {
        slug = newSlug;
      } else {
        counter++;
      }
    }

    doc[target] = slug;
  });
};
