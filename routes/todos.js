import express from "express";
import Todo from "../models/todo.js";
import auth from "../middleware/auth.js";
import nodemailer from "nodemailer"; 

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmailNotification = async (email, todo) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'You have been assigned a todo',
    text: `You have been assigned a new task: ${todo.title}. View it here: https://uptrack-phi.vercel.app/todos/${todo._id}`,
    html: `<p>You have been assigned a new task: <strong>${todo.title}</strong>.</p>
           <p><a href="https://uptrack-phi.vercel.app/todos/${todo._id}">View it here</a></p>`, 
  };

  await transporter.sendMail(mailOptions);
};

router.get("/api/todos/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const todos = await Todo.find({
      $or: [
        { userId },
        { assignedTo: authenticatedUserId }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json(todos);
  } catch (err) {
    console.error("Error fetching todos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/todos/detail/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUserId = req.user.id;

    const todo = await Todo.findOne({
      _id: id,
      $or: [
        { userId: authenticatedUserId },
        { assignedTo: authenticatedUserId }
      ]
    });

    if (!todo) {
      return res.status(404).json({ error: "Todo not found or unauthorized" });
    }

    res.status(200).json(todo);
  } catch (err) {
    console.error("Error fetching todo detail:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/todos", auth, async (req, res) => {
  try {
    const todoData = {
      ...req.body,
      userId: req.user.id,
      completed: false,
      showSubtasks: req.body.subtodos && req.body.subtodos.length > 0,
    };

    const newTodo = new Todo(todoData);
    await newTodo.save();

    if (newTodo.assignedTo) {
      await sendEmailNotification(newTodo.assignedTo, newTodo);
    }

    res.status(201).json(newTodo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.put("/api/todos/:id", auth, async (req, res) => {
  try {
    const { id } = req.params; 
    const userId = req.user.id; 

    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: id, userId },
      req.body,
      { new: true }
    );

    if (!updatedTodo) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.status(200).json(updatedTodo);
  } catch (err) {
    console.error("Error updating todo:", err);
    res.status(400).json({ error: err.message });
  }
});

router.put("/api/todos/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const updatedTodo = await Todo.findByIdAndUpdate(id, { title, description }, { new: true });
    if (!updatedTodo) {
      return res.status(404).json({ message: "Todo not found" });
    }
    res.json(updatedTodo);
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/todos/:id", auth, async (req, res) => {
  try {
    const deletedTodo = await Todo.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deletedTodo) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.status(200).json({ message: "Todo deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;