(() => {
  "use strict";

  function showAlert(form, message, kind) {
    const alert = form.querySelector(".form-alert");
    if (!alert) return;
    alert.hidden = false;
    alert.dataset.kind = kind;
    alert.textContent = message;
  }

  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.getAttribute("aria-controls"));
      if (!input) return;
      const isVisible = input.type === "text";
      input.type = isVisible ? "password" : "text";
      toggle.textContent = isVisible ? "Show" : "Hide";
      toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
    });
  });

  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const kind = form.dataset.authForm;
      if (kind === "set-password") {
        const password = form.querySelector('[name="password"]').value;
        const confirmation = form.querySelector('[name="confirmPassword"]').value;
        if (password !== confirmation) {
          showAlert(form, "Passwords do not match. Please try again.", "error");
          return;
        }
      }

      if (kind === "reset" && form.closest("[data-auth-modal]")) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        showAlert(form, "Check your email. If an account matches that email, we'll send a reset link.", "success");
        window.setTimeout(() => {
          if (submitButton) submitButton.disabled = false;
          document.dispatchEvent(new CustomEvent("auth:switch", { detail: "set-password" }));
        }, 900);
        return;
      }

      const messages = {
        login: "Sign-in submitted. Connect this form to your authentication endpoint.",
        register: "Registration submitted. Your account request is ready for review.",
        reset: "Reset link requested. Check your email for next steps.",
        "set-password": "Your new password has been saved successfully.",
      };
      showAlert(form, messages[kind] || "Your request was submitted.", "success");
      if (kind === "login") {
        window.setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 500);
      }
    });
  });

  const authModal = document.querySelector("[data-auth-modal]");
  if (authModal) {
    const previewGrid = document.querySelector(".landing-preview-grid");
    if (previewGrid) previewGrid.append(authModal);

    const panels = [...authModal.querySelectorAll("[data-auth-panel]")];

    function openAuthModal(view) {
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.authPanel !== view;
      });
      authModal.hidden = false;
      document.body.classList.add("auth-modal-open");
      const activePanel = authModal.querySelector(`[data-auth-panel="${view}"]`);
      activePanel?.querySelector("input, button")?.focus();
    }

    function closeAuthModal() {
      authModal.hidden = true;
      document.body.classList.remove("auth-modal-open");
    }

    document.querySelectorAll("[data-auth-modal-trigger]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openAuthModal(trigger.dataset.authModalTrigger);
      });
    });

    authModal.querySelectorAll("[data-auth-switch]").forEach((switchButton) => {
      switchButton.addEventListener("click", () => {
        openAuthModal(switchButton.dataset.authSwitch);
      });
    });

    document.addEventListener("auth:switch", (event) => {
      if (typeof event.detail === "string") openAuthModal(event.detail);
    });

    authModal.querySelectorAll("[data-auth-modal-close]").forEach((closeButton) => {
      closeButton.addEventListener("click", closeAuthModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !authModal.hidden) closeAuthModal();
    });
  }

  const dashboard = document.querySelector("[data-dashboard]");
  if (!dashboard) return;

  const roleData = {
    superadmin: {
      label: "SUPERADMIN",
      modules: ["Customers", "Products", "Human Resources", "Sales", "Reports"],
      administration: ["User Management", "System Settings"],
      canManageUsers: true,
    },
    admin: {
      label: "ADMIN",
      modules: ["Customers", "Products", "Human Resources", "Sales", "Reports"],
      administration: ["User Management"],
      canManageUsers: true,
    },
    user: {
      label: "USER",
      modules: ["Customers", "Products", "Sales"],
      administration: [],
      canManageUsers: false,
    },
  };

  const roleLabels = dashboard.querySelectorAll("[data-current-role]");
  const nav = dashboard.querySelector("[data-role-nav]");
  const management = dashboard.querySelector("[data-user-management]");
  const welcomeTitle = dashboard.querySelector("[data-welcome-title]");
  const welcomeCopy = dashboard.querySelector("[data-welcome-copy]");
  const managementDescription = dashboard.querySelector("[data-user-management-description]");
  const managementRole = dashboard.querySelector("[data-user-management-role]");
  let activeView = "dashboard";
  let activeNavItem = "dashboard";

  function setDashboardView(view) {
    const role = roleData[dashboard.dataset.role] || roleData.user;
    activeView = view === "user-management" && role.canManageUsers ? view : "dashboard";
    dashboard.querySelectorAll("[data-dashboard-view]").forEach((section) => {
      section.hidden = section.dataset.dashboardView !== activeView;
    });
    dashboard.querySelectorAll("[data-dashboard-view-link]").forEach((link) => {
      const isActive = link.dataset.dashboardNavItem === activeNavItem;
      link.style.setProperty("background-color", isActive ? "#89B8BF" : "transparent", "important");
      link.style.setProperty("color", isActive ? "#000000" : "", "important");
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function renderRole(role) {
    const data = roleData[role] || roleData.user;
    roleLabels.forEach((label) => {
      label.textContent = data.label;
    });
    const isAdmin = role === "admin";
    welcomeTitle.textContent = role === "superadmin"
      ? "Welcome, SuperAdmin!"
      : isAdmin ? "Welcome, Admin!" : "Welcome, User!";
    welcomeCopy.textContent = role === "superadmin"
      ? "You have full system access. You can manage all modules and assign roles to any user."
      : isAdmin
        ? "You can manage most modules and user rights (except Superadmin accounts)."
        : "You have access to the core modules assigned to you. Contact an Admin for elevated permissions.";
    managementDescription.textContent = isAdmin
      ? 'Admin: Manage Users only. Other Admin accounts show "—" in Actions.'
      : "Review access, account status, and permissions.";
    managementRole.textContent = data.label;
    const icons = {
      Customers: "👥",
      Products: "📦",
      "Human Resources": "💼",
      Sales: "📈",
      Reports: "📋",
      "User Management": "🔑",
      "System Settings": "⚙️",
    };
    const renderLinks = (items) => items.map((item) =>
      `<a class="erp-sidebar__link" href="#${item.toLowerCase().replaceAll(" ", "-")}" data-dashboard-view-link="${item === "User Management" ? "user-management" : "dashboard"}" data-dashboard-nav-item="${item.toLowerCase().replaceAll(" ", "-")}"><span class="erp-sidebar__icon" aria-hidden="true">${icons[item]}</span><span>${item}</span></a>`
    ).join("");
    nav.innerHTML = `<div class="erp-sidebar__nav-group"><p class="erp-sidebar__nav-heading">MODULES</p>${renderLinks(data.modules)}</div>`;
    if (data.administration.length) {
      nav.innerHTML += `<div class="erp-sidebar__nav-group"><p class="erp-sidebar__nav-heading">ADMINISTRATION</p>${renderLinks(data.administration)}</div>`;
    }
    dashboard.querySelectorAll("[data-dashboard-view-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        activeNavItem = link.dataset.dashboardNavItem;
        setDashboardView(link.dataset.dashboardViewLink);
      });
    });
    management.querySelectorAll("[data-user-role]").forEach((row) => {
      row.hidden = isAdmin && row.dataset.userRole === "superadmin";
      const actionCell = row.lastElementChild;
      if (!actionCell.dataset.defaultActions) {
        actionCell.dataset.defaultActions = actionCell.innerHTML;
      }
      if (isAdmin && row.dataset.userRole === "admin") {
        actionCell.innerHTML = "—";
      } else if (actionCell.dataset.defaultActions) {
        actionCell.innerHTML = actionCell.dataset.defaultActions;
      }
    });
    dashboard.querySelectorAll("[data-role-access]").forEach((element) => {
      element.hidden = !element.dataset.roleAccess.split(",").includes(role);
    });
    dashboard.querySelectorAll("[data-dashboard-view-trigger]").forEach((trigger) => {
      trigger.hidden = !data.canManageUsers;
    });
    dashboard.dataset.role = role;
    setDashboardView(activeView);
  }

  dashboard.querySelectorAll("[data-dashboard-view-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      activeNavItem = trigger.dataset.dashboardViewTrigger;
      setDashboardView(trigger.dataset.dashboardViewTrigger);
    });
  });
  const storedRole = sessionStorage.getItem("hope.dashboard.role");
  const fixedRole = dashboard.dataset.fixedRole;
  const initialRole = fixedRole && roleData[fixedRole]
    ? fixedRole
    : storedRole && roleData[storedRole]
      ? storedRole
      : dashboard.dataset.role || "user";
  renderRole(initialRole);

  management.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-rights]");
    if (button) {
      const dialog = dashboard.querySelector("[data-rights-dialog]");
      dialog.hidden = false;
      dialog.querySelector("input, button").focus();
    }
  });

  dashboard.querySelectorAll("[data-close-rights]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("[data-rights-dialog]").hidden = true;
    });
  });

  dashboard.querySelectorAll("[data-permission-group]").forEach((group) => {
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    group.querySelector("[data-select-all]").addEventListener("click", () => boxes.forEach((box) => { box.checked = true; }));
    group.querySelector("[data-deselect-all]").addEventListener("click", () => boxes.forEach((box) => { box.checked = false; }));
  });

  dashboard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dashboard.querySelectorAll("[data-rights-dialog]").forEach((dialog) => { dialog.hidden = true; });
    }
  });
})();
