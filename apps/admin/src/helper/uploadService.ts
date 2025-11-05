import axios from 'axios';
import fs from 'fs';

import config from '../config';


const {
  BUNNY_IMG_HOSTNAME,
  BUNNY_VIDEO_LIBRARY_ID,
  BUNNY_HOST_NAME,
  BUNNY_IMAGE_STORAGE_API_KEY,
  BUNNY_STORAGE_ZONE,
  BUNNY_STREAM_API_KEY,
} = config.bunny;

/**
 * Creates a video entry in Bunny Stream and returns the video ID.
 * @param title - The title of the video.
 * @returns {Promise<string>} - The Bunny video ID.
 */
const createVideoEntry = async (title: string): Promise<string> => {
  try {
    const response = await axios.post(
      `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos`,
      { title },
      {
        headers: {
          'Content-Type': 'application/json',
          AccessKey: BUNNY_STREAM_API_KEY,
        },
      }
    );
    return response.data.guid; // Bunny Stream returns the video ID as 'guid'
  } catch (error: any) {
    console.error('Error creating video entry:', error.response?.data || error.message);
    throw new Error('Failed to create video entry.');
  }
};

/**
 * Uploads a video file to Bunny Stream.
 * @param filePath - Local path to the video file.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<boolean>} - Upload success status.
 */
const uploadVideoToBunny = async (filePath: string, videoId: string): Promise<boolean> => {
  console.log("Access key stream: " + BUNNY_STREAM_API_KEY);
  try {
    const fileStream = fs.createReadStream(filePath);
    const response = await axios.put(
      `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`,
      fileStream,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          AccessKey: BUNNY_STREAM_API_KEY,
        },
      }
    );
    return response.status === 200;
  } catch (error: any) {
    console.error(`Error uploading video (ID: ${videoId}):`, error.response?.data || error.message);
    throw new Error('Video upload failed.');
  }
};

/**
 * Handles the complete video upload process.
 * @param filePath - Local path to the video file.
 * @param title - Video title.
 * @returns {Promise<string>} - The Bunny video ID.
 */
export const uploadVideoProcess = async (filePath: string, title: string): Promise<string> => {
  try {
    const videoId = await createVideoEntry(title);
    console.log(`Video entry created: ${videoId}`);
    const success = await uploadVideoToBunny(filePath, videoId);
    if (!success) throw new Error('Upload failed.');
    console.log(`Video uploaded successfully: ${videoId}`);
    return videoId;
  } catch (error: any) {
    console.error('Upload process failed:', error.message);
    throw error;
  }
};

/**
 * Get the video details from Bunny Stream API and return only the video length.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<number>} - The video length (in seconds).
 */
export const getBunnyVideoLength = async (videoId: string): Promise<number> => {
  try {
    const response = await axios.get(
      `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`,
      {
        headers: {
          AccessKey: BUNNY_STREAM_API_KEY,
        },
      }
    );

   
    // Assuming the response data contains a property named "length" which holds the video duration (in seconds)
    return response.data.length;
  } catch (error: any) {
    console.error('Error fetching video details:', error.response?.data || error.message);
    throw new Error('Failed to fetch video length.');
  }
};


/**
 * Fetches the Bunny Stream video playback URL.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<string>} - The video playback URL (HLS playlist).
 */export const getBunnyPreviewUrl = async (videoId: string): Promise<string> => {
 
  try {
    const videoPlayUrl = `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}/play?expires=100000`;
    const response = await axios.get(videoPlayUrl, {
      headers: {
        accept: 'application/json',
        AccessKey: BUNNY_STREAM_API_KEY,
      },
    });

    const videoData = response.data;
    const url = videoData.previewUrl;       // ← use this field

    if (!url) {
      throw new Error('Video playlist URL not found.');
    }
    return url;
  } catch (error: any) {
    console.error('Error fetching video playlist URL:', error.response?.data || error.message);
    throw new Error('Failed to fetch video playback URL.');
  }
};



/**
 * Uploads an image to Bunny CDN and returns both URL and image ID.
 * @param filePath - Local file path to the image.
 * @param imageId - Desired filename (used as unique ID).
 * @returns {Promise<{ url: string; imageId: string }>} - Image URL and ID.
 */
export const uploadImageToBunny = async (
  filePath: string,
  imageId: string
): Promise<{ url: string; imageId: string }> => {
  console.log("Storage access key:" + BUNNY_IMAGE_STORAGE_API_KEY);
  try {
    const fileStream = fs.createReadStream(filePath);
    const yourStorageZone = "videothumbnailfreebaj";
    const response = await axios.put(
      `https://ny.storage.bunnycdn.com/${yourStorageZone}/${imageId}`,
      fileStream,
      {
        headers: {
          AccessKey: BUNNY_IMAGE_STORAGE_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    if (response.status === 201 || response.status === 200) {
      const url = `https://ThumNailfreebajPull.b-cdn.net/${imageId}`;
      return { url, imageId };
    }

    throw new Error('Upload failed.');
  } catch (error: any) {
    console.error('Upload image failed:', error.message);
    throw error;
  }
};


/**
 * Deletes a video from Bunny Stream by ID.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<boolean>} - Deletion success status.
 */
export const deleteVideoFromBunny = async (videoId: string): Promise<boolean> => {
  try {
    const response = await axios.delete(
      `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`,
      {
        headers: {
          AccessKey: BUNNY_STREAM_API_KEY,
        },
      }
    );
    console.log(`Deleted video with ID: ${videoId}`);
    return response.status === 204;
  } catch (error: any) {
    console.error(`Error deleting video (ID: ${videoId}):`, error.response?.data || error.message);
    throw new Error('Video deletion failed.');
  }
};


/**
 * Deletes an image from Bunny CDN by image ID (filename).
 * @param imageId - The filename of the image stored.
 * @returns {Promise<boolean>} - Deletion success status.
 */
export const deleteImageFromBunny = async (imageId: string): Promise<boolean> => {
  const yourStorageZone = "videothumbnailfreebaj";

  try {
    const response = await axios.delete(
      `https://ny.storage.bunnycdn.com/${yourStorageZone}/${imageId}`,
      {
        headers: {
          AccessKey: BUNNY_IMAGE_STORAGE_API_KEY,
        },
      }
    );
    console.log(`Deleted image with ID: ${imageId}`);
    return response.status === 200;
  } catch (error: any) {
    console.error(`Error deleting image (ID: ${imageId}):`, error.response?.data || error.message);
    throw new Error('Image deletion failed.');
  }
};

