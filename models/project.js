import mongoose from 'mongoose';

const contributorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'planning', 'completed', 'on-hold'],
    default: 'planning'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contributors: [contributorSchema]
}, {
  timestamps: true
});

// Index for efficient queries
projectSchema.index({ createdBy: 1 });
projectSchema.index({ 'contributors.userId': 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;
