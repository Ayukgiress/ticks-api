import express from "express";
import auth from "../middleware/auth.js";
import { getUserforSidebar } from "../controllers/message.controllers.js";
import { getmessages } from "../controllers/message.controllers.js";
import { sendMessage } from "../controllers/message.controllers.js";

const router = express.Router;

router.get("/users", auth, getUserforSidebar);

router.get("/:id", auth, getmessages);

router.post("/send/:id", auth, sendMessage);
export default router;
