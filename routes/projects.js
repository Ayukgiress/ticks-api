import express from "express";
import Project from "../models/project.js";
import Todo from "../models/todo.js";
import User from "../models/user.js";
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

// Helper function to check if user can access project
const canAccessProject = (project, userId) => {
  return project.createdBy.toString() === userId.toString() ||
         project.contributors.some(c => c.userId.toString() === userId.toString() && c.status === 'accepted');
};

// Helper function to check if user is project creator
const isProjectCreator = (project, userId) => {
  return project.createdBy.toString() === userId.toString();
};

// POST /api/projects - Create new project
router.post("/api/projects", auth, async (req, res) => {
  try {
    const { name, description, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const newProject = new Project({
      name,
      description: description || '',
      status: status || 'planning',
      createdBy: req.user.id,
      contributors: []
    });

    await newProject.save();

    res.status(201).json(newProject);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:userId - Get all projects for a user
router.get("/api/projects/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const projects = await Project.find({
      $or: [
        { createdBy: userId },
        { 'contributors.userId': userId, 'contributors.status': 'accepted' }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json(projects);
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/project/:projectId - Get single project details
router.get("/api/projects/project/:projectId", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!canAccessProject(project, userId)) {
      return res.status(401).json({ error: "Unauthorized access to project" });
    }

    res.status(200).json(project);
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:projectId - Update project
router.put("/api/projects/:projectId", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { name, description, status } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!isProjectCreator(project, userId)) {
      return res.status(401).json({ error: "Only project creator can update project" });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { name, description, status },
      { new: true }
    );

    res.status(200).json(updatedProject);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId - Delete project
router.delete("/api/projects/:projectId", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!isProjectCreator(project, userId)) {
      return res.status(401).json({ error: "Only project creator can delete project" });
    }

    // Delete all todos associated with this project
    await Todo.deleteMany({ projectId });

    await Project.findByIdAndDelete(projectId);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/invite - Send invitation to contributor
router.post("/api/projects/:projectId/invite", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!isProjectCreator(project, userId)) {
      return res.status(401).json({ error: "Only project creator can send invitations" });
    }

    // Check if user is already a contributor
    const existingContributor = project.contributors.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (existingContributor) {
      return res.status(400).json({ error: "User is already a contributor to this project" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // Add to contributors
    project.contributors.push({
      userId: user._id,
      email: email.toLowerCase(),
      name,
      status: 'pending',
      invitedAt: new Date()
    });

    await project.save();

    // Send invitation email
    const invitationUrl = `http://localhost:5174/projects/${projectId}/accept-invitation?email=${encodeURIComponent(email)}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invitation to join project: ${project.name}`,
      text: `You have been invited to join the project "${project.name}". Click here to accept: ${invitationUrl}`,
      html: `<h2>Project Invitation</h2>
             <p>You have been invited to join the project: <strong>${project.name}</strong></p>
             <p>Description: ${project.description}</p>
             <p><a href="${invitationUrl}">Accept Invitation</a></p>`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Invitation sent successfully" });
  } catch (err) {
    console.error("Error sending invitation:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/contributors - Get project contributors
router.get("/api/projects/:projectId/contributors", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!canAccessProject(project, userId)) {
      return res.status(401).json({ error: "Unauthorized access to project" });
    }

    res.status(200).json(project.contributors);
  } catch (err) {
    console.error("Error fetching contributors:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project-contributors - Get all project contributors (owners and accepted contributors)
router.get("/api/project-contributors", auth, async (req, res) => {
  try {
    const projects = await Project.find({});

    const userIds = new Set();

    projects.forEach(project => {
      // Add owner
      userIds.add(project.createdBy.toString());

      // Add accepted contributors
      project.contributors.forEach(contributor => {
        if (contributor.status === 'accepted' && contributor.userId) {
          userIds.add(contributor.userId.toString());
        }
      });
    });

    const uniqueUserIds = Array.from(userIds);

    const users = await User.find({ _id: { $in: uniqueUserIds } }).select('username email');

    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching project contributors:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project-contributors/:userId - Get project contributors for a specific user (owners and accepted contributors on shared projects)
router.get("/api/project-contributors/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    // Find projects where the user is owner or accepted contributor
    const projects = await Project.find({
      $or: [
        { createdBy: userId },
        { 'contributors.userId': userId, 'contributors.status': 'accepted' }
      ]
    });

    const userIds = new Set();

    projects.forEach(project => {
      // Add owner
      userIds.add(project.createdBy.toString());

      // Add accepted contributors
      project.contributors.forEach(contributor => {
        if (contributor.status === 'accepted' && contributor.userId) {
          userIds.add(contributor.userId.toString());
        }
      });
    });

    // Remove the current user from the set to avoid self-chat
    userIds.delete(userId);

    const uniqueUserIds = Array.from(userIds);

    const users = await User.find({ _id: { $in: uniqueUserIds } }).select('username email');

    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching project contributors:", err);
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/projects/:projectId/contributors/:contributorId - Remove contributor
router.delete("/api/projects/:projectId/contributors/:contributorId", auth, async (req, res) => {
  try {
    const { projectId, contributorId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!isProjectCreator(project, userId)) {
      return res.status(401).json({ error: "Only project creator can remove contributors" });
    }

    // Find and remove contributor
    const contributorIndex = project.contributors.findIndex(c => c._id.toString() === contributorId);
    if (contributorIndex === -1) {
      return res.status(404).json({ error: "Contributor not found" });
    }

    project.contributors.splice(contributorIndex, 1);
    await project.save();

    res.status(200).json({ message: "Contributor removed successfully" });
  } catch (err) {
    console.error("Error removing contributor:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/tasks - Get all tasks for a project
router.get("/api/projects/:projectId/tasks", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!canAccessProject(project, userId)) {
      return res.status(401).json({ error: "Unauthorized access to project" });
    }

    const todos = await Todo.find({ projectId }).sort({ createdAt: -1 });

    res.status(200).json(todos);
  } catch (err) {
    console.error("Error fetching project tasks:", err);
    res.status(500).json({ error: err.message });
  }
});



export default router;
