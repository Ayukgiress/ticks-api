import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import dotenv from "dotenv";
import registerValidator from "../utils/registerValidator.js";
import loginValidator from "../utils/loginValidator.js";
import auth from "../middleware/auth.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import passport from "passport";

dotenv.config();
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/register", registerValidator, (req, res, next) => {
  const { username, email, password } = req.body;

  User.findOne({ email })
    .then(existingUser => {
      if (existingUser) {
        return res.status(400).json({ msg: "User already exists" });
      }

      const verificationToken = crypto.randomBytes(20).toString("hex");
      const verificationTokenExpires = Date.now() + 3600000;

      const user = new User({
        username,
        email,
        password,
        verificationToken,
        verificationTokenExpires,
      });

      return user.save().then(() => {
        const verificationUrl = `https://uptrack-phi.vercel.app/verify-email/${verificationToken}`;

        return transporter.sendMail({
          to: user.email,
          subject: "Email Verification",
          html: `<h2>Email Verification</h2>
                 <p>Please click the link below to verify your email:</p>
                 <p><a href="${verificationUrl}">Verify Email</a></p>`,
        });
      })
      .then(() => {
        res.status(201).json({
          msg: "Registration successful! Please check your email to verify your account.",
        });
      })
      .catch(err => {
        console.error(err);
        next(err);
      });
    })
    .catch(err => {
      console.error(err);
      next(err);
    });
});

router.post('/verify-email/:token', (req, res, next) => {
  const { token } = req.params;

  User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: Date.now() },
  })
    .then(user => {
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token.',
        });
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;

      return user.save().then(() => {
        const payload = { user: { id: user.id } };
        const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
          success: true,
          message: 'Email verified successfully!',
          token: jwtToken,
        });
      });
    })
    .catch(error => {
      console.error('Verification error:', error);
      next(error);
    });
});

router.post("/resend-verification-code", (req, res, next) => {
  const { email } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      const verificationToken = crypto.randomBytes(20).toString("hex");
      const verificationTokenExpires = Date.now() + 3600000;
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = verificationTokenExpires;

      return user.save().then(() => {
        const verificationUrl = `https://uptrack-phi.vercel.app/verify-email/${verificationToken}`;

        return transporter.sendMail({
          to: user.email,
          subject: "Email Verification",
          html: `<h2>Email Verification</h2>
                 <p>Please click the link below to verify your email:</p>
                 <p><a href="${verificationUrl}">Verify Email</a></p>`,
        });
      })
      .then(() => {
        res.json({ message: "New verification email sent successfully" });
      })
      .catch(error => {
        console.error("Error resending verification code:", error);
        next(error);
      });
    })
    .catch(error => {
      console.error("Error finding user:", error);
      next(error);
    });
});

router.post("/login", loginValidator, (req, res, next) => {
  const { email, password } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        return res.status(400).json({ msg: "Invalid email or password" });
      }

      return user.matchPassword(password).then(isMatch => {
        if (!isMatch) {
          return res.status(400).json({ msg: "Invalid email or password" });
        }

        const payload = { user: { id: user.id } };
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

        user.refreshToken = refreshToken;
        return user.save().then(() => {
          res.json({ accessToken, refreshToken });
        });
      });
    })
    .catch(err => {
      console.error("Login error:", err);
      next(err);
    });
});

router.post("/refresh-token", (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ msg: "Refresh token required" });

  User.findOne({ refreshToken })
    .then(user => {
      if (!user) {
        return res.status(401).json({ msg: "Invalid refresh token" });
      }

      jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).json({ msg: "Invalid refresh token" });
        }

        const payload = { user: { id: decoded.user.id } };
        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7h" });

        res.json({ accessToken: newAccessToken });
      });
    })
    .catch(err => {
      console.error(err);
      next(err);
    });
});

router.get("/current-user", auth, (req, res, next) => {
  User.findById(req.user._id).select('-password')
    .then(user => {
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      res.json({ success: true, data: user });
    })
    .catch(error => {
      console.error("Error fetching current user:", error);
      next();
    });
});

router.get('/auth/google', (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login',
  }, (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
    }

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }

    try {
      const token = jwt.sign(
        { user: { id: user._id.toString(), email: user.email, username: user.username } },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Token creation error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_creation_failed`);
    }
  })(req, res, next);
});

router.get("/profile", auth, (req, res, next) => {
  User.findById(req.user.id).select("email")
    .then(user => {
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    })
    .catch(error => {
      next(error);
    });
});

router.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred",
  });
});

export default router;
