import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: { 
    type: Date 
  },
  subtodos: [{
    title: { 
      type: String, 
      required: true,
      trim: true 
    },
    completed: { 
      type: Boolean, 
      default: false 
    }
  }],
  showSubtasks: { 
    type: Boolean, 
    default: false 
  },
  supervisor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedTo: { 
    type: String, 
    default: null 
  },
  comments: [{
    text: { type: String },
    author: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  completedBy: { type: String, default: null },
  completedAt: { type: Date, default: null }
}, { 
  timestamps: true 
});

const Todo = mongoose.model('Todo', todoSchema);

export default Todo;
