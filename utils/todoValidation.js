import Joi from 'joi';

const todoSchema = Joi.object({
  title: Joi.string().trim().min(1).required(),
  description: Joi.string().optional(),
  subtodos: Joi.array().items(Joi.object({
    title: Joi.string().trim().min(1).required(),
    completed: Joi.boolean().optional(),
  })).optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  dueDate: Joi.date().greater('now').optional(), 
});

const validateTodo = (data) => {
  return todoSchema.validate(data);
};

export { validateTodo };