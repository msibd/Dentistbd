"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function SecurityView({
  onResult,
}: {
  onResult: (result: { message: string; error: boolean }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 10) {
      onResult({ message: "Password must be at least 10 characters.", error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      onResult({ message: "New passwords do not match.", error: true });
      return;
    }

    setSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not update password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onResult({ message: "Password updated. Other active sessions were signed out.", error: false });
    } catch (error) {
      onResult({
        message: error instanceof Error ? error.message : "Could not update password.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-card security-card">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Change password</h2>
          <div className="panel-description">Use a unique password with at least 10 characters.</div>
        </div>
        <span className="stat-icon"><LockKeyhole size={16} /></span>
      </div>
      <form className="security-form" onSubmit={updatePassword}>
        <div className="form-field">
          <label htmlFor="currentPassword">Current password</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="security-note">Your new password is never stored in the application environment file.</div>
        <button className="button-primary" type="submit" disabled={saving}>
          <LockKeyhole size={14} /> {saving ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
