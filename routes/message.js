import express from "express";
import auth from "../middleware/auth";

const router = express.Router;

router.get("/users", auth, getUserforSidebar);

router.get("/:id", auth, getmessages);

router.post("/send/:id", auth, sendMessage);
export default router;
