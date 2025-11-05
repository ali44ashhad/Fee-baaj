import express from 'express';
import { streamVideo } from './controller'; // Import both the video stream and segment controllers

const router = express.Router();

// Video streaming (fetching playlist)
router.get('/stream/:videoId', (req, res) => {
    streamVideo(req, res).catch((err) => {
        console.error("Error in streamVideo route:", err);
        res.status(500).json({ error: "Internal server error" });
    });
});


export default router;
