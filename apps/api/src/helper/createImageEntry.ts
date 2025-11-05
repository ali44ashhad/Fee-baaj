import { v4 as uuidv4 } from "uuid";

/**
 * Generates a unique image ID for BunnyCDN.
 * Uses UUID to ensure uniqueness.
 */
export const createImageEntry = (originalFilename: string): string => {
  const extension = originalFilename.split(".").pop(); // Get file extension
  return `${uuidv4()}.${extension}`; // Generate unique ID
};
