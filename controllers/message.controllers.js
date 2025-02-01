import Message from "../models/message";
import User from "../models/user";

export const getUserforSidebar = async (req, res) => {
  try {
    const loggedinUserId = req.user._id;
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
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const messages = await Message.find({
      $or: [
        { senderId: myId, recieverId: userToChatId },
        { senderId: userToChatId, recieverId: myId },
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
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure.url;
    }

    const newMessage = new Message({
      senderId,
      recieverId,
      text,
      image: imageUrl,
    });
    await newMessage.save();

    res.status(200).json(newMessage);
  } catch (error) {
    console.log("error in sendmessages controller:", error.message);
    res.status(500).json({ error: "internal server error" });
  }
};
