// frontend/src/components/RegisterForm.js

/**
 * Registration form component.
 * Sends POST /auth/register to backend.
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

function RegisterForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("http://localhost:7005/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(data.error || "Registration failed.");
        return;
      }

      login({ user: data.user, token: data.token });
      setStatusMessage("Registration successful. You are now logged in.");
    } catch (err) {
      console.error("Error in register request:", err);
      setStatusMessage("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>

      <div>
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Registering..." : "Register"}
      </button>

      {statusMessage && <p>{statusMessage}</p>}
    </form>
  );
}

export default RegisterForm;
