export const MESSAGES = {
  AUTH: {
    REGISTER_SUCCESS: 'Registration successful',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logged out successfully',
    TOKEN_REFRESH_SUCCESS: 'Token refreshed successfully',
    SESSION_REVOKED: 'Session revoked successfully',
    DEVICE_INFO_MISSING: 'Device info not available',
    EMAIL_EXISTS: 'User with this email already exists',
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCOUNT_DEACTIVATED: 'Account is deactivated',
    NO_TOKEN: 'No token provided',
    INVALID_TOKEN: 'Invalid or expired token',
    REFRESH_TOKEN_REQUIRED: 'Refresh token is required',
    INVALID_SESSION: 'Invalid or expired session',
    SESSION_EXPIRED: 'Session expired',
    TOKEN_REUSE: 'Token reuse detected. All sessions revoked.',
    NOT_AUTHENTICATED: 'Not authenticated',
    SESSION_NOT_FOUND: 'Session not found',
    USER_NOT_FOUND: 'User not found',
    USER_INACTIVE: 'User not found or inactive',
  },
  USER: {
    NOT_FOUND: 'User not found',
    PROFILE_UPDATED: 'Profile updated successfully',
    NO_UPDATES: 'No valid fields to update',
    ROLE_UPDATED: 'User role updated successfully',
    DEACTIVATED: 'User deactivated successfully',
    ACTIVATED: 'User activated successfully',
    INVALID_ROLE: 'Invalid role. Allowed roles: {roles}',
  },
  SERVER: {
    INTERNAL_ERROR: 'Internal server error',
    ROUTE_NOT_FOUND: 'Route not found',
    TOO_MANY_REQUESTS: 'Too many requests from this IP, please try again later',
    TOO_MANY_ATTEMPTS: 'Too many attempts, please try again later',
    INVALID_ID: 'Invalid ID format',
    TOKEN_EXPIRED: 'Token expired',
    RESOURCE_CREATED: 'Resource created successfully',
    REDIS_CLIENT_NOT_INIT: 'Redis client not initialized. Call connect() first.',
    REDIS_PUB_NOT_INIT: 'Redis publisher not initialized. Call connect() first.',
    REDIS_SUB_NOT_INIT: 'Redis subscriber not initialized. Call connect() first.',
    SOCKET_NOT_INIT: 'Socket.IO not initialized. Call initialize() first.',
    AUTH_REQUIRED: 'Authentication required',
  },
  CHAT: {
    // Conversation
    CONVERSATION_NOT_FOUND: 'Conversation not found',
    CONVERSATION_CREATED: 'Conversation created successfully',
    CONVERSATION_UPDATED: 'Conversation updated successfully',
    CONVERSATION_DELETED: 'Conversation deleted successfully',
    NOT_PARTICIPANT: 'You are not a participant of this conversation',
    ALREADY_PARTICIPANT: 'User is already a participant',
    CANNOT_REMOVE_ADMIN: 'Cannot remove the conversation creator',
    CANNOT_MESSAGE_SELF: 'Cannot create conversation with yourself',
    GROUP_NAME_REQUIRED: 'Group name is required for group conversations',
    MIN_PARTICIPANTS: 'Group conversation requires at least 2 other participants',
    PARTICIPANT_ADDED: 'Participant added successfully',
    PARTICIPANT_REMOVED: 'Participant removed successfully',
    LEFT_CONVERSATION: 'Left conversation successfully',
    NOT_ADMIN: 'Only admins can perform this action',
    CANNOT_LEAVE_DIRECT: 'Cannot leave a direct conversation',

    // Messages
    MESSAGE_NOT_FOUND: 'Message not found',
    MESSAGE_SENT: 'Message sent successfully',
    MESSAGE_UPDATED: 'Message updated successfully',
    MESSAGE_DELETED: 'Message deleted successfully',
    CANNOT_EDIT_OTHERS_MESSAGE: "Cannot edit another user's message",
    CANNOT_DELETE_OTHERS_MESSAGE: "Cannot delete another user's message for everyone",
    MESSAGE_TOO_LONG: 'Message content is too long',
    EMPTY_MESSAGE: 'Message content cannot be empty',

    // Reactions
    REACTION_ADDED: 'Reaction added',
    REACTION_REMOVED: 'Reaction removed',
    REACTION_NOT_FOUND: 'Reaction not found',

    // Mute
    CONVERSATION_MUTED: 'Conversation muted',
    CONVERSATION_UNMUTED: 'Conversation unmuted',

    // Read
    MARKED_AS_READ: 'Conversation marked as read',

    // Archive
    CONVERSATION_ARCHIVED: 'Conversation archived',
    CONVERSATION_UNARCHIVED: 'Conversation unarchived',

    // Pin
    MESSAGE_PINNED: 'Message pinned',
    MESSAGE_UNPINNED: 'Message unpinned',
    CONVERSATION_PINNED: 'Conversation pinned',
    CONVERSATION_UNPINNED: 'Conversation unpinned',

    // Typing
    TYPING_STARTED: 'User started typing',
    TYPING_STOPPED: 'User stopped typing',
  },
};
