import express from "express";
import auth from "../middleware/auth.js";
import { getUserforSidebar, getmessages, sendMessage } from "../controllers/message.controllers.js";
import { voiceUpload } from "../config/multerConfig.js";

const router = express.Router();

router.get("/users", auth, getUserforSidebar);
router.get("/:id", auth, getmessages);
router.post("/send/:id", auth, voiceUpload.single('voice'), sendMessage);

export default router;
