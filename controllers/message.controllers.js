import Message from "../models/message.js";
import User from "../models/user.js";
import cloudinary from '../cloudService.js';
import { io } from '../app.js';

export const getUserforSidebar = async (req, res) => {
  try {
    const loggedinUserId = req.user.id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedinUserId },
    }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("error in getuserforsidebar:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

export const getmessages = async (req, res) => {
  try {
    const { id: userEmail } = req.params;
    const myId = req.user.id;
    const userToChat = await User.findOne({ email: userEmail });
    if (!userToChat) {
      return res.status(404).json({ error: "User not found" });
    }
    const userToChatId = userToChat._id;
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });
    res.status(200).json(messages);
  } catch (error) {
    console.log("error in getmessages controller:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user?.id;
    const { id: receiverEmailFromParams } = req.params;
    const { receiverId: receiverEmailFromBody, text, image } = req.body;
    const receiverEmail = receiverEmailFromParams || receiverEmailFromBody;

    if (!senderId || !receiverEmail) {
      return res.status(400).json({ error: "Participants must be provided" });
    }

    const receiver = await User.findOne({ email: receiverEmail });
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }
    const receiverId = receiver._id;

    if (!text && !image && !req.file) {
      return res.status(400).json({ error: "Message content is required" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let voiceUrl;
    if (req.file) {
      voiceUrl = `${req.protocol}://${req.get("host")}/uploads/voices/${req.file.filename}`;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      voice: voiceUrl,
    });

    io.to(receiverId.toString()).emit("newMessage", newMessage);
    io.to(senderId.toString()).emit("newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
