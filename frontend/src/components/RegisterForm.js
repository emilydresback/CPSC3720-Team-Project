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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || "Registration failed.");
        return;
      }

      login({ user: data.user, token: data.token });
      setStatusMessage("Registration successful.");
    } catch {
      setStatusMessage("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Register</h2>

      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? "Registering..." : "Register"}
        </button>

        {statusMessage && <p className="auth-status">{statusMessage}</p>}
      </form>

      <style>{authStyles}</style>
    </div>
  );
}
// updated UI
const authStyles = `
  :root {
    --color-purple: #522D80;
    --color-orange: #F57D00;
    --color-light-gray: #F0F0F0;
    --color-dark-text: #333333;
  }

  .auth-card {
    max-width: 420px;
    margin: 3rem auto;
    padding: 2rem;
    background: #fff;
    border: 1px solid var(--color-light-gray);
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
  }

  h2 {
    color: var(--color-purple);
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-orange);
    padding-bottom: .5rem;
    text-align: center;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    font-weight: 600;
    color: var(--color-dark-text);
  }

  input {
    padding: .75rem;
    border-radius: 6px;
    border: 1px solid #CCC;
    background-color: #FFF;
    font-size: 1rem;
  }

  input:focus {
    outline: 2px solid var(--color-purple);
  }

  .auth-submit {
    background: var(--color-purple);
    color: white;
    border: none;
    padding: .75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: .5rem;
  }

  .auth-submit:hover {
    background: var(--color-orange);
  }

  .auth-submit:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .auth-status {
    margin-top: 1rem;
    padding: .75rem;
    border-radius: 6px;
    background: #FFF3E0;
    border: 1px solid var(--color-orange);
    color: var(--color-dark-text);
    font-weight: 500;
    text-align: center;
  }
`;



export default RegisterForm;
