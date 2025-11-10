# TODO: Replace Hardcoded URLs with Environment Variables

## Tasks
- [x] Add FRONTEND_URL=http://localhost:5174 to .env
- [x] Update app.js: Replace hardcoded CORS origins with process.env.FRONTEND_URL
- [x] Update routes/users.js: Replace hardcoded URLs in verification and redirect URLs
- [x] Update routes/projects.js: Replace hardcoded URLs in invitation URLs
- [x] Update routes/accept-invitation.js: Replace hardcoded URLs in invitation URLs
- [x] Update routes/todos.js: Replace hardcoded URLs in email links

## Followup Steps
- [ ] Test application functionality
- [ ] Verify email notifications and redirects work
