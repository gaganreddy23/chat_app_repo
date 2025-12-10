const UserModel = require("../models/UserModel");
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function checkPassword(request, response) {
  try {
    const { password, userId } = request.body;
    if (!userId || !password) {
      return response.status(400).json({ message: "userId and password required", error: true });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return response.status(404).json({ message: "User not found", error: true });
    }

    const verifyPassword = await bcryptjs.compare(password, user.password);
    if (!verifyPassword) {
      return response.status(400).json({ message: "Incorrect password", error: true });
    }

    const tokenData = {
      id: user._id,
      email: user.email
    };

    // support both env names (so .env can use JWT_SECRET)
    const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
    if (!secret) {
      console.error("FATAL: JWT secret is missing (JWT_SECRET_KEY / JWT_SECRET).");
      return response.status(500).json({ message: "Internal server error", error: true });
    }

    const token = jwt.sign(tokenData, secret, { expiresIn: '1d' });

    // cookie options: for local dev use secure:false; in production use secure:true & sameSite:'None' with HTTPS
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,           // false on localhost, true in production (HTTPS)
      sameSite: isProd ? 'None' : 'Lax', // adjust for your use-case
      maxAge: 24 * 60 * 60 * 1000 // 1 day in ms
    };

    return response
      .cookie('token', token, cookieOptions)
      .status(200)
      .json({
        message: "Login successful",
        token,
        success: true
      });

  } catch (error) {
    console.error("checkPassword error:", error);
    return response.status(500).json({
      message: error.message || error,
      error: true
    });
  }
}

module.exports = checkPassword;
