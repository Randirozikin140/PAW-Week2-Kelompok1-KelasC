const jwt = require("jsonwebtoken");

// Memeriksa header "Authorization: Bearer <token>"
function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Token tidak ditemukan. Login dulu." });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Token tidak valid atau sudah kedaluwarsa." });
  }
}

function onlyRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ message: "Akses ditolak untuk role ini." });
}

module.exports = { verifyToken, onlyRole };
