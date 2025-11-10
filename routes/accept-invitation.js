import express from "express";
import Project from "../models/project.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ message: "Accept invitation router is working!" });
});

// GET /api/projects/:projectId - Get project details for invitation page (public access)
router.get("/api/projects/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.query;

    console.log('Fetching project for invitation:', { projectId, email });

    // Validate projectId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      console.log('Invalid project ID format:', projectId);
      return res.status(400).json({ error: "Invalid project ID format" });
    }

    const project = await Project.findById(projectId);
    console.log('Project found:', project ? 'Yes' : 'No');

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If email is provided, verify the invitation exists
    if (email) {
      console.log('Checking for contributor with email:', email);
      console.log('Project contributors:', project.contributors);
      
      const contributor = project.contributors.find(
        c => c.email.toLowerCase() === email.toLowerCase()
      );

      if (!contributor) {
        console.log('No contributor found for email:', email);
        return res.status(404).json({ error: "Invitation not found for this email" });
      }

      console.log('Contributor status:', contributor.status);
      if (contributor.status !== 'pending') {
        return res.status(400).json({ 
          error: "Invitation already processed",
          status: contributor.status 
        });
      }
    }

    // Return only necessary project details (don't expose sensitive info)
    const projectData = {
      _id: project._id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt
    };

    res.status(200).json({ project: projectData });
  } catch (err) {
    console.error("Error fetching project for invitation:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/accept-invitation - Accept project invitation
router.post("/api/projects/:projectId/accept-invitation", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Find the contributor
    const contributor = project.contributors.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (!contributor) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (contributor.status !== 'pending') {
      return res.status(400).json({ error: "Invitation already processed" });
    }

    // Find user by email and set userId
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update contributor status and set userId
    contributor.status = 'accepted';
    contributor.userId = user._id;
    await project.save();

    res.status(200).json({ message: "Invitation accepted successfully", project });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/decline-invitation - Decline project invitation
router.post("/api/projects/:projectId/decline-invitation", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Find the contributor
    const contributor = project.contributors.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (!contributor) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (contributor.status !== 'pending') {
      return res.status(400).json({ error: "Invitation already processed" });
    }

    // Update contributor status
    contributor.status = 'declined';
    await project.save();

    res.status(200).json({ message: "Invitation declined successfully" });
  } catch (err) {
    console.error("Error declining invitation:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/invite - Invite a contributor to a project
// POST /api/projects/:projectId/invite - Invite a contributor to a project
router.post("/api/projects/:projectId/invite", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if contributor already exists
    const existingContributor = project.contributors.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (existingContributor) {
      return res.status(400).json({ error: "Contributor already invited" });
    }

    // Add contributor with pending status
    project.contributors.push({
      email: email.toLowerCase(),
      name,
      status: 'pending'
    });

    await project.save();

    // Send invitation email
    const invitationUrl = `${process.env.FRONTEND_URL}/projects/${projectId}/accept-invitation?email=${encodeURIComponent(email)}`;
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
    console.error("Error inviting contributor:", err);
    res.status(500).json({ error: err.message });
  }
});



export default router;