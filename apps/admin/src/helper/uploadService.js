"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImageFromBunny = exports.deleteVideoFromBunny = exports.uploadImageToBunny = exports.getBunnyPreviewUrl = exports.getBunnyVideoLength = exports.uploadVideoProcess = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("../config"));
const { BUNNY_IMG_HOSTNAME, BUNNY_VIDEO_LIBRARY_ID, BUNNY_HOST_NAME, BUNNY_IMAGE_STORAGE_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_STREAM_API_KEY, } = config_1.default.bunny;
/**
 * Creates a video entry in Bunny Stream and returns the video ID.
 * @param title - The title of the video.
 * @returns {Promise<string>} - The Bunny video ID.
 */
const createVideoEntry = async (title) => {
    try {
        const response = await axios_1.default.post(`https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos`, { title }, {
            headers: {
                'Content-Type': 'application/json',
                AccessKey: BUNNY_STREAM_API_KEY,
            },
        });
        return response.data.guid; // Bunny Stream returns the video ID as 'guid'
    }
    catch (error) {
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
const uploadVideoToBunny = async (filePath, videoId) => {
    console.log("Access key stream: " + BUNNY_STREAM_API_KEY);
    try {
        const fileStream = fs_1.default.createReadStream(filePath);
        const response = await axios_1.default.put(`https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`, fileStream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                AccessKey: BUNNY_STREAM_API_KEY,
            },
        });
        return response.status === 200;
    }
    catch (error) {
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
const uploadVideoProcess = async (filePath, title) => {
    try {
        const videoId = await createVideoEntry(title);
        console.log(`Video entry created: ${videoId}`);
        const success = await uploadVideoToBunny(filePath, videoId);
        if (!success)
            throw new Error('Upload failed.');
        console.log(`Video uploaded successfully: ${videoId}`);
        return videoId;
    }
    catch (error) {
        console.error('Upload process failed:', error.message);
        throw error;
    }
};
exports.uploadVideoProcess = uploadVideoProcess;
/**
 * Get the video details from Bunny Stream API and return only the video length.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<number>} - The video length (in seconds).
 */
const getBunnyVideoLength = async (videoId) => {
    try {
        const response = await axios_1.default.get(`https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`, {
            headers: {
                AccessKey: BUNNY_STREAM_API_KEY,
            },
        });
        // Assuming the response data contains a property named "length" which holds the video duration (in seconds)
        return response.data.length;
    }
    catch (error) {
        console.error('Error fetching video details:', error.response?.data || error.message);
        throw new Error('Failed to fetch video length.');
    }
};
exports.getBunnyVideoLength = getBunnyVideoLength;
/**
 * Fetches the Bunny Stream video playback URL.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<string>} - The video playback URL (HLS playlist).
 */ const getBunnyPreviewUrl = async (videoId) => {
    try {
        const videoPlayUrl = `https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}/play?expires=100000`;
        const response = await axios_1.default.get(videoPlayUrl, {
            headers: {
                accept: 'application/json',
                AccessKey: BUNNY_STREAM_API_KEY,
            },
        });
        const videoData = response.data;
        const url = videoData.previewUrl; // ← use this field
        if (!url) {
            throw new Error('Video playlist URL not found.');
        }
        return url;
    }
    catch (error) {
        console.error('Error fetching video playlist URL:', error.response?.data || error.message);
        throw new Error('Failed to fetch video playback URL.');
    }
};
exports.getBunnyPreviewUrl = getBunnyPreviewUrl;
/**
 * Uploads an image to Bunny CDN and returns both URL and image ID.
 * @param filePath - Local file path to the image.
 * @param imageId - Desired filename (used as unique ID).
 * @returns {Promise<{ url: string; imageId: string }>} - Image URL and ID.
 */
const uploadImageToBunny = async (filePath, imageId) => {
    console.log("Storage access key:" + BUNNY_IMAGE_STORAGE_API_KEY);
    try {
        const fileStream = fs_1.default.createReadStream(filePath);
        const yourStorageZone = "videothumbnailfreebaj";
        const response = await axios_1.default.put(`https://ny.storage.bunnycdn.com/${yourStorageZone}/${imageId}`, fileStream, {
            headers: {
                AccessKey: BUNNY_IMAGE_STORAGE_API_KEY,
                'Content-Type': 'application/octet-stream',
            },
        });
        if (response.status === 201 || response.status === 200) {
            const url = `https://ThumNailfreebajPull.b-cdn.net/${imageId}`;
            return { url, imageId };
        }
        throw new Error('Upload failed.');
    }
    catch (error) {
        console.error('Upload image failed:', error.message);
        throw error;
    }
};
exports.uploadImageToBunny = uploadImageToBunny;
/**
 * Deletes a video from Bunny Stream by ID.
 * @param videoId - The Bunny Video ID.
 * @returns {Promise<boolean>} - Deletion success status.
 */
const deleteVideoFromBunny = async (videoId) => {
    try {
        const response = await axios_1.default.delete(`https://video.bunnycdn.com/library/${BUNNY_VIDEO_LIBRARY_ID}/videos/${videoId}`, {
            headers: {
                AccessKey: BUNNY_STREAM_API_KEY,
            },
        });
        console.log(`Deleted video with ID: ${videoId}`);
        return response.status === 204;
    }
    catch (error) {
        console.error(`Error deleting video (ID: ${videoId}):`, error.response?.data || error.message);
        throw new Error('Video deletion failed.');
    }
};
exports.deleteVideoFromBunny = deleteVideoFromBunny;
/**
 * Deletes an image from Bunny CDN by image ID (filename).
 * @param imageId - The filename of the image stored.
 * @returns {Promise<boolean>} - Deletion success status.
 */
const deleteImageFromBunny = async (imageId) => {
    const yourStorageZone = "videothumbnailfreebaj";
    try {
        const response = await axios_1.default.delete(`https://ny.storage.bunnycdn.com/${yourStorageZone}/${imageId}`, {
            headers: {
                AccessKey: BUNNY_IMAGE_STORAGE_API_KEY,
            },
        });
        console.log(`Deleted image with ID: ${imageId}`);
        return response.status === 200;
    }
    catch (error) {
        console.error(`Error deleting image (ID: ${imageId}):`, error.response?.data || error.message);
        throw new Error('Image deletion failed.');
    }
};
exports.deleteImageFromBunny = deleteImageFromBunny;
