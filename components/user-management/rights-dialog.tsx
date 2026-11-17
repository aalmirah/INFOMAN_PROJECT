"use client";

import { useEffect, useRef, useState } from "react";
import { isRecord, isRightsResponse, type RightsResponse } from "@/lib/user-management/rights";

type Props = {
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
};

function message(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null &&
      "error" in value && typeof value.error === "string") return value.error;
  return fallback;
}

export default function RightsDialog({ userId, userName, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rights, setRights] = useState<RightsResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hasChanges = rights !== null &&
    (selected.length !== rights.selected.length ||
      selected.some((id) => !rights.selected.includes(id)));
  const totalRights = rights?.modules.reduce((total, module) => total + module.rights.length, 0) ?? 0;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/user-management/${userId}/rights`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(message(data, "Could not load rights."));
        if (!isRightsResponse(data)) throw new Error("The server returned an invalid rights catalogue.");
        setRights(data);
        setSelected(data.selected);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load rights.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [userId]);

  function close() {
    dialog.current?.close();
    onClose();
  }

  function setModule(ids: number[], checked: boolean) {
    setSelected((current) => checked
      ? [...new Set([...current, ...ids])]
      : current.filter((id) => !ids.includes(id)));
  }

  async function save() {
    if (!rights || rights.readOnly || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/user-management/${userId}/rights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogue: rights.modules.flatMap((module) => module.rights.map((right) => right.id)),
          expected: rights.selected,
          selected,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(message(data, "Could not save rights."));
      if (!isRecord(data) || typeof data.changed !== "number" ||
          !Number.isSafeInteger(data.changed) || data.changed < 0) {
        throw new Error("Could not verify the rights save.");
      }
      onSaved();
      close();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save rights.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      aria-describedby="um-rights-description um-rights-selection"
      aria-labelledby="um-rights-title"
      className="um-rights-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) close();
      }}
      ref={dialog}
    >
      <header className="um-rights-header">
        <div>
          <h2 id="um-rights-title">Rights for {userName}</h2>
          <p id="um-rights-description">Configure fine-grained permissions per module.</p>
          <p aria-live="polite" className="um-rights-selection" id="um-rights-selection">
            {rights
              ? `Selected ${selected.length} of ${totalRights}`
              : error
                ? "Rights selection unavailable."
                : "Loading selected rights..."}
          </p>
        </div>
        <button aria-label="Close rights dialog" disabled={saving} onClick={close} type="button">×</button>
      </header>
      <div className="um-rights-content">
        {!rights && !error && <p role="status">Loading rights...</p>}
        {error && <p className="um-error" role="alert">{error}</p>}
        {rights?.readOnly && <p>Superadmins have full system access. Their rights are read-only.</p>}
        {hasChanges && <p role="status">You have unsaved changes.</p>}
        {rights?.modules.map((module) => {
          const ids = module.rights.map((right) => right.id);
          const selectedCount = ids.filter((id) => selected.includes(id)).length;
          const disabled = saving || rights.readOnly;
          return (
            <section className="um-rights-module" key={module.code}>
              <div className="um-rights-module-header">
                <label>
                  <input
                    checked={selectedCount === ids.length}
                    disabled={disabled}
                    onChange={(event) => setModule(ids, event.target.checked)}
                    ref={(input) => {
                      if (input) input.indeterminate = selectedCount > 0 && selectedCount < ids.length;
                    }}
                    type="checkbox"
                  />
                  <strong>{module.name}</strong>
                </label>
                <div>
                  <button aria-label={`Select all ${module.name} rights`} disabled={disabled}
                    onClick={() => setModule(ids, true)} type="button">All</button>
                  <button aria-label={`Clear all ${module.name} rights`} disabled={disabled}
                    onClick={() => setModule(ids, false)} type="button">None</button>
                </div>
              </div>
              <div className="um-rights-options">
                {module.rights.map((right) => (
                  <label key={right.id}>
                    <input
                      checked={selected.includes(right.id)}
                      disabled={disabled}
                      onChange={(event) => setModule([right.id], event.target.checked)}
                      type="checkbox"
                    />
                    {right.label}
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <footer className="um-rights-footer">
        <button className="button button-secondary" disabled={saving} onClick={close} type="button">
          {rights?.readOnly ? "Close" : "Cancel"}
        </button>
        {rights && !rights.readOnly && (
          <button className="button button-primary" disabled={saving || !hasChanges} onClick={() => void save()} type="button">
            {saving ? "Saving..." : "Save rights"}
          </button>
        )}
      </footer>
    </dialog>
  );
}
