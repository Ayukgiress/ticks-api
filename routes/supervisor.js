import express from "express";
import Todo from "../models/todo.js";
import nodemailer from "nodemailer"; 

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


router.get("/api/public-todos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.query; 
  
      const todo = await Todo.findOne({
        _id: id,
        assignedTo: email.toLowerCase()
      });
  
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }
  
      res.status(200).json(todo);
    } catch (err) {
      console.error("Error fetching todo:", err);
      res.status(500).json({ error: err.message });
    }
  });
  
  router.post("/api/public-todos/:id/comment", async (req, res) => {
    try {
      const { id } = req.params;
      const { text, email } = req.body;
  
      const todo = await Todo.findOne({
        _id: id,
        assignedTo: email.toLowerCase()
      }).populate({
        path: 'userId',
        select: 'email' 
      });
  
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }
  
      if (!todo.userId || !todo.userId.email) {
        console.error("Cannot find todo creator's email", {
          todoId: todo._id,
          hasUserId: !!todo.userId
        });
        return res.status(400).json({ error: "Cannot notify todo creator" });
      }
  
      todo.comments.push({
        text,
        author: email,
        createdAt: new Date()
      });
  
      await todo.save();
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: todo.userId.email,  
        subject: 'New comment on your todo',
        text: `${email} commented on your todo: "${todo.title}"\n\nComment: ${text}`,
        html: `<p><strong>${email}</strong> commented on your todo: "${todo.title}"</p>
               <p>Comment: ${text}</p>
               <p>View todo: https://uptrack-phi.vercel.app/supervisor/todos/${todo._id}</p>`
      };
  
      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Failed to send email notification:", {
          error: emailError.message,
          todoId: todo._id,
          recipientEmail: todo.userId.email,
          senderEmail: process.env.EMAIL_USER
        });
      }
  
      res.status(200).json(todo);
    } catch (err) {
      console.error("Error adding comment:", err);
      res.status(500).json({ error: err.message });
    }
  });
  
  
  router.put("/api/public-todos/:id/complete", async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.body;
  
      const todo = await Todo.findOne({
        _id: id,
        assignedTo: email.toLowerCase()
      });
  
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }
  
      todo.completed = true;
      todo.completedBy = email;
      todo.completedAt = new Date();
  
      await todo.save();
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: todo.userId.email,
        subject: 'Todo marked as complete',
        text: `Your todo "${todo.title}" has been marked as complete by ${email}`,
        html: `<p>Your todo "<strong>${todo.title}</strong>" has been marked as complete by ${email}.</p>
               <p>Completed at: ${new Date().toLocaleString()}</p>`
      };
  
      await transporter.sendMail(mailOptions);
  
      res.status(200).json(todo);
    } catch (err) {
      console.error("Error completing todo:", err);
      res.status(500).json({ error: err.message });
    }
  });
  
  export default router;