# TODO: Extend Backend for Messaging Features (Voice Uploads and Real-Time Updates)

## Steps to Complete
- [x] Update Message model to include voice field for file path
- [x] Configure Multer in app.js for voice file uploads to /uploads/voices/
- [x] Modify routes/message.js to use Multer middleware on sendMessage route
- [x] Update controllers/message.controllers.js to handle voice file saving and store path in DB
- [x] Ensure uploads/voices/ directory exists and is writable
- [x] Test the voice upload functionality
- [x] Integrate Socket.IO for real-time messaging
- [x] Set up Socket.IO server in app.js attached to HTTP server
- [x] Handle socket connections and join users to rooms based on user IDs with authentication
- [x] Emit 'newMessage' event in sendMessage controller after saving message
- [x] Test Socket.IO integration for real-time updates on text and voice messages

# TODO: Add GET Endpoint for Accepting Project Invitations via Link

## Steps to Complete
- [x] Add GET /api/projects/:projectId/accept-invitation endpoint in routes/accept-invitation.js
- [x] Implement logic to accept invitation using projectId from params and email from query params
- [x] Return appropriate JSON response on success or error
- [x] Test the new GET endpoint functionality
