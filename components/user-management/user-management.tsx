"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserRole = "user" | "admin" | "superadmin";
type AccountStatus = "active" | "pending" | "inactive" | "blocked";

type ManagedUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
};

type UserListResponse = {
  users: ManagedUser[];
  actorRole: "admin" | "superadmin";
  actorId: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PendingAccount = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: string;
};

const EMPTY_LIST: UserListResponse = {
  users: [],
  actorRole: "admin",
  actorId: "",
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
};

function getErrorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

function isManagedUser(value: unknown): value is ManagedUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    (typeof user.firstName === "string" || user.firstName === null) &&
    (typeof user.lastName === "string" || user.lastName === null) &&
    (typeof user.email === "string" || user.email === null) &&
    (user.role === "user" ||
      user.role === "admin" ||
      user.role === "superadmin") &&
    (user.accountStatus === "active" ||
      user.accountStatus === "pending" ||
      user.accountStatus === "inactive" ||
      user.accountStatus === "blocked") &&
    typeof user.createdAt === "string"
  );
}

function isUserListResponse(value: unknown): value is UserListResponse {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    Array.isArray(result.users) &&
    result.users.every(isManagedUser) &&
    (result.actorRole === "admin" || result.actorRole === "superadmin") &&
    typeof result.actorId === "string" &&
    typeof result.page === "number" &&
    typeof result.pageSize === "number" &&
    typeof result.total === "number" &&
    typeof result.totalPages === "number"
  );
}

function displayName(user: ManagedUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
}

function initials(user: ManagedUser): string {
  const first = user.firstName?.trim().charAt(0) ?? "";
  const last = user.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function statusLabel(status: AccountStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function UserManagement() {
  const [list, setList] = useState<UserListResponse>(EMPTY_LIST);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState({ firstName: "", lastName: "" });
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAccount[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    if (list.actorRole !== "superadmin") return;
    const controller = new AbortController();
    fetch("/api/superadmin/pending", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Could not load pending accounts."));
        }
        const rows = (data as { pending?: unknown }).pending;
        setPending(Array.isArray(rows) ? (rows as PendingAccount[]) : []);
        setPendingError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPendingError(
          error instanceof Error ? error.message : "Could not load pending accounts.",
        );
      });
    return () => controller.abort();
  }, [list.actorRole, refreshKey]);

  async function runAccountAction(
    userId: string,
    action: "approve" | "reject" | "promote" | "demote",
    label: string,
  ) {
    if (
      (action === "reject" || action === "demote") &&
      !window.confirm(`Are you sure you want to ${action} ${label}?`)
    ) {
      return;
    }
    setBusyUserId(userId);
    setNotice(null);
    setLoadError(null);
    setPendingError(null);
    try {
      const response = await fetch(`/api/superadmin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Could not complete this action."));
      }
      const message = (data as { message?: unknown }).message;
      setNotice(typeof message === "string" ? message : "Done.");
      setIsLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not complete this action.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== search) {
        setIsLoading(true);
        setLoadError(null);
        setSearch(nextSearch);
        setPage(1);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    const query = new URLSearchParams({
      page: String(page),
      role: roleFilter,
      status: statusFilter,
      search,
    });

    const response = await fetch(`/api/user-management?${query}`, {
      cache: "no-store",
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Could not load users. Please try again."),
      );
    }
    if (!isUserListResponse(data)) {
      throw new Error("The server returned an invalid user list.");
    }
    return data;
  }, [page, roleFilter, search, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchUsers = async () => {
      try {
        const users = await loadUsers(controller.signal);
        if (controller.signal.aborted) return;
        setList(users);
        setLoadError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load users. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void fetchUsers();
    return () => controller.abort();
  }, [loadUsers, refreshKey]);

  const roleOptions = useMemo(
    () =>
      list.actorRole === "superadmin"
        ? [
            ["all", "All roles"],
            ["user", "User"],
            ["admin", "Admin"],
            ["superadmin", "Superadmin"],
          ]
        : [["all", "All roles"], ["user", "User"], ["admin", "Admin"]],
    [list.actorRole],
  );

  async function addUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);
    setNotice(null);
    setIsAdding(true);
    try {
      const response = await fetch("/api/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not add user. Please try again."),
        );
      }
      setNewUser({ firstName: "", lastName: "", email: "" });
      setShowAddForm(false);
      setIsLoading(true);
      setLoadError(null);
      setRoleFilter("all");
      setStatusFilter("all");
      setSearchInput("");
      setSearch("");
      setPage(1);
      setRefreshKey((key) => key + 1);
      setNotice("User added as a pending account.");
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : "Could not add user. Please try again.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  function beginEdit(user: ManagedUser) {
    setNotice(null);
    setEditingUserId(user.id);
    setEditName({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
    });
  }

  async function saveName(userId: string) {
    setBusyUserId(userId);
    setNotice(null);
    setLoadError(null);
    try {
      const response = await fetch(`/api/user-management/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editName),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not update user. Please try again."),
        );
      }
      setEditingUserId(null);
      setNotice("User details updated.");
      setIsLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not update user. Please try again.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function toggleBlocked(user: ManagedUser) {
    const isBlocking = user.accountStatus !== "blocked";
    const action = isBlocking ? "block" : "unblock";
    const name = displayName(user);
    if (
      !window.confirm(
        `Are you sure you want to ${action} ${name} (${user.email ?? "no email"})?`,
      )
    ) {
      return;
    }

    setBusyUserId(user.id);
    setNotice(null);
    setLoadError(null);
    try {
      const response = await fetch(`/api/user-management/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: isBlocking }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, `Could not ${action} user. Please try again.`),
        );
      }
      setNotice(`User ${isBlocking ? "blocked" : "unblocked"}.`);
      setIsLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : `Could not ${action} user. Please try again.`,
      );
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand brand-on-dark" href="/session">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Hope, Inc. ERP</span>
        </Link>
        <nav className="app-nav app-nav-grouped" aria-label="Administration navigation">
          <div>
            <span className="nav-group-label">Dashboard</span>
            <Link className="app-nav-link" href="/session">Dashboard</Link>
          </div>
          <div>
            <span className="nav-group-label">Administration</span>
            <Link
              aria-current="page"
              className="app-nav-link is-active"
              href="/user-management"
            >
              User Management
            </Link>
          </div>
        </nav>
      </aside>

      <main className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>User Management</h1>
          </div>
          <button
            className="button button-primary"
            onClick={() => {
              setShowAddForm((visible) => !visible);
              setAddError(null);
            }}
            type="button"
          >
            {showAddForm ? "Cancel" : "Add User"}
          </button>
        </header>

        {list.actorRole === "superadmin" && (
          <section className="table-card um-pending" aria-labelledby="um-pending-title">
            <div className="table-toolbar">
              <div>
                <h2 id="um-pending-title">Pending approvals</h2>
                <p className="form-help">
                  Approve to activate an account, or reject to remove it.
                </p>
              </div>
            </div>
            {pendingError && <p className="um-error-banner" role="alert">{pendingError}</p>}
            {pending.length === 0 ? (
              <p className="um-state-cell">No accounts are waiting for approval.</p>
            ) : (
              <div className="table-wrap">
                <table className="user-management-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((account) => {
                      const label =
                        [account.firstName, account.lastName].filter(Boolean).join(" ") ||
                        account.email ||
                        "this account";
                      const isBusy = busyUserId === account.id;
                      return (
                        <tr key={account.id}>
                          <td><strong>{label}</strong></td>
                          <td>{account.email || "—"}</td>
                          <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div className="um-actions">
                              <button
                                className="table-action um-action-button"
                                disabled={isBusy}
                                onClick={() => void runAccountAction(account.id, "approve", label)}
                                type="button"
                              >
                                Approve
                              </button>
                              <button
                                className="table-action um-action-button danger-action"
                                disabled={isBusy}
                                onClick={() => void runAccountAction(account.id, "reject", label)}
                                type="button"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className="table-card" aria-labelledby="um-directory-title">
          <div className="table-toolbar">
            <div>
              <h2 id="um-directory-title">User directory</h2>
              <p className="form-help">
                {list.actorRole === "superadmin"
                  ? "Manage user access and account details."
                  : "Manage User accounts. Admin accounts are view-only."}
              </p>
            </div>
            <div className="table-filters">
              <label className="um-search">
                <span className="um-visually-hidden">Search users by name or email</span>
                <input
                  className="table-search"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.trim() !== search) {
                      setIsLoading(true);
                      setLoadError(null);
                    }
                    setSearchInput(value);
                  }}
                  placeholder="Search users by name or email..."
                  type="search"
                  value={searchInput}
                />
              </label>
              <label>
                <span className="um-visually-hidden">Filter by role</span>
                <select
                  className="role-filter"
                  onChange={(event) => {
                    setIsLoading(true);
                    setLoadError(null);
                    setRoleFilter(event.target.value);
                    setPage(1);
                  }}
                  value={roleFilter}
                >
                  {roleOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="um-visually-hidden">Filter by account status</span>
                <select
                  className="role-filter"
                  onChange={(event) => {
                    setIsLoading(true);
                    setLoadError(null);
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  value={statusFilter}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
            </div>
          </div>

          {notice && (
            <p className="um-notice" role="status">{notice}</p>
          )}

          {showAddForm && (
            <form className="um-add-form" onSubmit={addUser}>
              <div className="um-form-heading">
                <h3>Add a user</h3>
                <p>New accounts are created as regular Users and remain pending.</p>
              </div>
              <div className="um-form-fields">
                <label className="um-field">
                  <span>First name</span>
                  <input
                    autoComplete="given-name"
                    maxLength={80}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    required
                    value={newUser.firstName}
                  />
                </label>
                <label className="um-field">
                  <span>Last name</span>
                  <input
                    autoComplete="family-name"
                    maxLength={80}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    required
                    value={newUser.lastName}
                  />
                </label>
                <label className="um-field um-email-field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    maxLength={320}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                    type="email"
                    value={newUser.email}
                  />
                </label>
              </div>
              {addError && <p className="um-error" role="alert">{addError}</p>}
              <div className="um-form-actions">
                <button
                  className="button button-primary"
                  disabled={isAdding}
                  type="submit"
                >
                  {isAdding ? "Adding..." : "Create user"}
                </button>
              </div>
            </form>
          )}

          {loadError && (
            <div className="um-error-banner" role="alert">
              <span>{loadError}</span>
              <button
                className="um-retry-button"
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  setRefreshKey((key) => key + 1);
                }}
                type="button"
              >
                Try again
              </button>
            </div>
          )}

          <div className="table-wrap" aria-busy={isLoading}>
            <table className="user-management-table">
              <caption className="um-visually-hidden">
                User account directory
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={5}>Loading users...</td>
                  </tr>
                ) : list.users.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={5}>
                      {loadError ? "Users could not be loaded." : "No users found."}
                    </td>
                  </tr>
                ) : (
                  list.users.map((user) => {
                    const canManage =
                      user.id !== list.actorId &&
                      (list.actorRole === "superadmin"
                        ? user.role === "user" || user.role === "admin"
                        : user.role === "user");
                    const isEditing = editingUserId === user.id;
                    const isBusy = busyUserId === user.id;
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <span className="avatar" aria-hidden="true">
                              {initials(user)}
                            </span>
                            <div className="um-user-details">
                              {isEditing ? (
                                <span className="um-edit-name-fields">
                                  <input
                                    aria-label={`First name for ${displayName(user)}`}
                                    className="um-inline-input"
                                    maxLength={80}
                                    onChange={(event) =>
                                      setEditName((current) => ({
                                        ...current,
                                        firstName: event.target.value,
                                      }))
                                    }
                                    value={editName.firstName}
                                  />
                                  <input
                                    aria-label={`Last name for ${displayName(user)}`}
                                    className="um-inline-input"
                                    maxLength={80}
                                    onChange={(event) =>
                                      setEditName((current) => ({
                                        ...current,
                                        lastName: event.target.value,
                                      }))
                                    }
                                    value={editName.lastName}
                                  />
                                </span>
                              ) : (
                                <strong>{displayName(user)}</strong>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{user.email || "—"}</td>
                        <td>
                          <span className={`role-badge role-${user.role}`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${user.accountStatus}`}>
                            {statusLabel(user.accountStatus)}
                          </span>
                        </td>
                        <td>
                          {canManage ? (
                            <div className="um-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    className="um-action-button"
                                    disabled={isBusy}
                                    onClick={() => void saveName(user.id)}
                                    type="button"
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="table-action um-action-muted"
                                    disabled={isBusy}
                                    onClick={() => setEditingUserId(null)}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className={`table-action um-action-button ${
                                      user.accountStatus === "blocked"
                                        ? ""
                                        : "danger-action"
                                    }`}
                                    disabled={isBusy}
                                    onClick={() => void toggleBlocked(user)}
                                    type="button"
                                  >
                                    {user.accountStatus === "blocked"
                                      ? "Unblock"
                                      : "Block"}
                                  </button>
                                  {list.actorRole === "superadmin" &&
                                    user.accountStatus === "active" &&
                                    (user.role === "user" || user.role === "admin") && (
                                      <button
                                        className="table-action um-action-button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          void runAccountAction(
                                            user.id,
                                            user.role === "user" ? "promote" : "demote",
                                            displayName(user),
                                          )
                                        }
                                        type="button"
                                      >
                                        {user.role === "user" ? "Make Admin" : "Make User"}
                                      </button>
                                    )}
                                  <button
                                    className="table-action um-action-button"
                                    disabled={isBusy}
                                    onClick={() => beginEdit(user)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                            </div>
                          ) : <span aria-label="No actions available">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="um-pagination">
            <p>
              {list.total === 0
                ? "No accounts"
                : `${list.total} account${list.total === 1 ? "" : "s"}`}
            </p>
            <div>
              <button
                className="um-page-button"
                disabled={isLoading || page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  setPage((current) => Math.max(1, current - 1));
                }}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {list.totalPages === 0 ? 0 : page} of {list.totalPages}
              </span>
              <button
                className="um-page-button"
                disabled={isLoading || page >= list.totalPages}
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  setPage((current) => Math.min(list.totalPages, current + 1));
                }}
                type="button"
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
