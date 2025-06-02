// middleware/roleMiddleware.js
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
      const userRole = req.user.role; // Assuming req.user is set by authenticateToken
      if (allowedRoles.includes(userRole)) {
        next();
      } else {
        res.sendStatus(403); // Forbidden
      }
    };
  };
  
  module.exports = roleMiddleware;
  