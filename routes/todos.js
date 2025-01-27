import express from "express";
import Todo from "../models/todo.js";
import auth from "../middleware/auth.js";
import nodemailer from "nodemailer";
import { validateTodo } from '../utils/todoValidation.js'; 


const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmailNotification = (email, todo) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'You have been assigned a todo',
    text: `You have been assigned a new task: ${todo.title}. View it here: https://uptrack-phi.vercel.app/supervisor/todos/${todo._id}?email=${encodeURIComponent(email)}`,
    html: `<p>You have been assigned a new task: <strong>${todo.title}</strong>.</p>
           <p><a href="https://uptrack-phi.vercel.app/supervisor/todos/${todo._id}?email=${encodeURIComponent(email)}">View it here</a></p>`,
  };

  return transporter.sendMail(mailOptions);
};

router.get("/api/todos/:userId", auth, (req, res, next) => {
  const { userId } = req.params;
  const authenticatedUserId = req.user.id;

  if (authenticatedUserId !== userId) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  Todo.find({
    $or: [
      { userId },
      { assignedTo: authenticatedUserId }
    ]
  })
  .sort({ createdAt: -1 })
  .then(todos => res.status(200).json(todos))
  .catch(err => {
    console.error("Error fetching todos:", err);
    res.status(500).json({ error: err.message });
    next(err);
  });
});

router.get("/api/todos/detail/:id", async (req, res, next) => {
  const { id } = req.params;
  const supervisorEmail = req.query.supervisor;
  
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid ID format" });
  }

  try {
      let query = { _id: id };
      
      if (req.user) {
          query.$or = [
              { userId: req.user.id },
              { assignedTo: req.user.email }
          ];
      } 
      else if (supervisorEmail) {
          query.assignedTo = supervisorEmail;
      }

      const todo = await Todo.findOne(query);
      
      if (!todo) {
          return res.status(404).json({ error: "Todo not found or unauthorized" });
      }
      
      if (!req.user) {
          const { userId, ...safeData } = todo.toObject();
          return res.status(200).json(safeData);
      }
      
      res.status(200).json(todo);
  } catch (err) {
      console.error("Error fetching todo detail:", err);
      res.status(500).json({ error: err.message });
      next(err);
  }
});
router.post("/api/todos", auth, (req, res, next) => {
  const { error } = validateTodo(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const todoData = {
    ...req.body,
    userId: req.user.id,
    completed: false,
    showSubtasks: req.body.subtodos && req.body.subtodos.length > 0,
  };

  const newTodo = new Todo(todoData);
  newTodo.save()
    .then(savedTodo => {
      if (savedTodo.assignedTo) {
        return sendEmailNotification(savedTodo.assignedTo, savedTodo)
          .then(() => res.status(201).json(savedTodo));
      } else {
        res.status(201).json(savedTodo);
      }
    })
    .catch(err => {
      console.error("Error saving todo:", err);
      res.status(400).json({ error: err.message });
      next();
    });
});

router.get("/api/todos/supervisor/:id", async (req, res) => {
  const { id } = req.params;
  const { email } = req.query;

  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid ID format" });
  }

  if (!email) {
      return res.status(400).json({ error: "Supervisor email is required" });
  }

  try {
      const todo = await Todo.findOne({
          _id: id,
          assignedTo: email
      });

      if (!todo) {
          return res.status(404).json({ error: "Todo not found or unauthorized" });
      }

      // Remove sensitive information
      const { userId, __v, ...safeData } = todo.toObject();
      res.status(200).json(safeData);
  } catch (err) {
      console.error("Error fetching todo:", err);
      res.status(500).json({ error: err.message });
  }
});

router.put("/api/todos/:id", auth, async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const todo = await Todo.findById(id);
    
    if (!todo) {
      return res.status(404).json({ error: "Todo not found" });
    }

    if (todo.userId.toString() !== userId && todo.assignedTo !== req.user.email) {
      return res.status(401).json({ error: "Unauthorized to modify this todo" });
    }

    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    res.status(200).json(updatedTodo);
  } catch (err) {
    console.error("Error updating todo:", err);
    res.status(500).json({ error: err.message });
    next(err);
  }
});

router.put("/api/todos/edit/:id", (req, res, next) => {
  const { id } = req.params;
  const { title, description } = req.body;

  Todo.findByIdAndUpdate(id, { title, description }, { new: true })
    .then(updatedTodo => {
      if (!updatedTodo) {
        return res.status(404).json({ message: "Todo not found" });
      }
      res.json(updatedTodo);
    })
    .catch(error => {
      console.error("Error updating todo:", error);
      res.status(500).json({ message: "Internal server error" });
      next();
    });
});

router.delete("/api/todos/:id", auth, (req, res, next) => {
  Todo.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id,
  })
    .then(deletedTodo => {
      if (!deletedTodo) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.status(200).json({ message: "Todo deleted" });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
      next();
    });
});

export default router;
