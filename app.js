import createError from "http-errors";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import connectDB from "./config/dbconfig.js";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import session from "express-session";
import initializePassport from "./passport-setup.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join", (userId) => {
    if (!userId) {
      return;
    }
    socket.join(userId);
    onlineUsers.set(socket.id, userId);
    console.log(`User ${userId} joined room`);

    // Emit updated online users list to all connected clients
    const onlineUserIds = Array.from(new Set(onlineUsers.values()));
    io.emit("getOnlineUsers", onlineUserIds);
  });

  socket.on("sendMessage", (message) => {
    if (!message || !message.recieverId || !message.senderId) {
      return;
    }
    const recieverRoom = message.recieverId.toString();
    const senderRoom = message.senderId.toString();
    io.to(recieverRoom).emit("newMessage", message);
    io.to(senderRoom).emit("newMessage", message);
  });

  socket.on("disconnect", () => {
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      onlineUsers.delete(socket.id);
      console.log(`user ${userId} disconnected`);

      // Emit updated online users list to all connected clients
      const onlineUserIds = Array.from(new Set(onlineUsers.values()));
      io.emit("getOnlineUsers", onlineUserIds);
      return;
    }
    console.log("user disconnected");
  });
});

dotenv.config();

const port = process.env.PORT || 5000;

app.use(logger("dev"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());

app.use(express.static(path.join(path.resolve(), "public")));
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "https://taskydev.vercel.app"],
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Welcome to the Todo API!");
});

import usersRouter from "./routes/users.js";
import todoRoute from "./routes/todos.js";
import messageRoute from "./routes/message.js";
import projectRoute from "./routes/projects.js";
import acceptInvitationRoute from "./routes/accept-invitation.js";


app.use("/users", usersRouter);
app.use("/todos", todoRoute);
app.use("/message", messageRoute);
app.use("/projects", projectRoute);
app.use("/accept-invitation", acceptInvitationRoute);


connectDB();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

initializePassport(app);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

app.use((err, req, res, next) => {
  console.error("Error details:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
    },
  });
});

server.listen(port, () => console.log(`Server started on port ${port}`));

export { io };
export default app;
