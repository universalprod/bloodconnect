import {
  isFirebaseConfigured,
  saveSubmission,
  searchDonors,
  signInCoordinator,
  signOutCoordinator,
  watchCoordinatorSession,
} from "./firebase.js";
import {
  validateDonor,
  validateDonorSearch,
  validateRequest,
} from "./validation.js";

const validators = {
  donor: validateDonor,
  request: validateRequest,
};

const coordinatorLogin = document.querySelector("#coordinator-login");
const coordinatorStatus = document.querySelector("#coordinator-status");
const coordinatorTools = document.querySelector("#coordinator-tools");
const searchStatus = document.querySelector("#search-status");
const donorResults = document.querySelector("#donor-results");

function setStatus(element, message, type = "error") {
  element.textContent = message;
  element.className = `coordinator-status coordinator-status-${type}`;
}

function createDonorResult(donor) {
  const result = document.createElement("article");
  result.className = "donor-result";

  const name = document.createElement("h4");
  name.textContent = donor.fullName;
  const location = document.createElement("p");
  location.textContent = `${donor.bloodGroup} · ${donor.city}`;
  const contact = document.createElement("a");
  contact.textContent = `${donor.contactLabel}: ${donor.contactValue}`;
  contact.href = donor.contactLabel === "Email"
    ? `mailto:${donor.contactValue}`
    : `tel:${donor.contactValue}`;
  result.append(name, location, contact);
  return result;
}

function showCoordinatorSession(user) {
  coordinatorLogin.hidden = Boolean(user);
  coordinatorTools.hidden = !user;
  if (user) {
    document.querySelector("#coordinator-account").textContent = user.email;
    setStatus(coordinatorStatus, "");
  } else {
    document.querySelector("#coordinator-account").textContent = "";
    document.querySelector("#donor-search-form").reset();
    setStatus(
      coordinatorStatus,
      "Sign in with an authorized coordinator account to search.",
      "info",
    );
  }
  searchStatus.textContent = "";
  donorResults.replaceChildren();
}

document.querySelector("#year").textContent = String(new Date().getFullYear());

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
  navigation.classList.toggle("nav-open", !isOpen);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    navigation.classList.remove("nav-open");
  }
});

const requestDate = document.querySelector('#request-form [name="neededBy"]');
const today = new Date();
requestDate.min = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

if (!isFirebaseConfigured()) {
  setStatus(
    coordinatorStatus,
    "Firebase is not configured. Add your Firebase web app settings before signing in or searching.",
  );
} else {
  setStatus(coordinatorStatus, "Checking coordinator access...", "info");
  watchCoordinatorSession(showCoordinatorSession, (error) => {
    console.error("Could not verify coordinator access.", error);
    showCoordinatorSession(null);
    setStatus(
      coordinatorStatus,
      error.message === "This account is not authorized for coordinator access."
        ? error.message
        : "Could not verify coordinator access. Check Firebase Authentication and Firestore rules.",
    );
  }).catch((error) => {
    console.error("Could not initialize Firebase Authentication.", error);
    setStatus(
      coordinatorStatus,
      "Could not connect to Firebase. Check the web app configuration and your internet connection.",
    );
  });
}

coordinatorLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(coordinatorLogin);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const submitButton = coordinatorLogin.querySelector('[type="submit"]');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus(coordinatorStatus, "Enter a valid coordinator email address.");
    return;
  }
  if (password.length < 8 || password.length > 128) {
    setStatus(coordinatorStatus, "Enter your password (at least 8 characters).");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";
  setStatus(coordinatorStatus, "Signing in...", "info");
  try {
    await signInCoordinator(email, password);
  } catch (error) {
    console.error("Coordinator sign-in failed.", error);
    setStatus(
      coordinatorStatus,
      !isFirebaseConfigured()
        ? "Firebase is not configured. Add your web app settings in src/firebase-config.js as described in the setup guide."
        : error.code === "auth/invalid-credential" || error.code === "auth/user-not-found"
          ? "Sign-in failed. Check your email and password, then try again."
          : "Could not sign in. Check Firebase Authentication setup and try again.",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Sign in <span aria-hidden="true">↗</span>';
  }
});

document.querySelector("#coordinator-signout").addEventListener("click", async () => {
  const signOutButton = document.querySelector("#coordinator-signout");
  signOutButton.disabled = true;
  signOutButton.textContent = "Signing out...";
  setStatus(searchStatus, "Signing out...", "info");
  try {
    await signOutCoordinator();
  } catch (error) {
    console.error("Coordinator sign-out failed.", error);
    setStatus(
      searchStatus,
      !isFirebaseConfigured()
        ? "Firebase is not configured. Add the web app settings in src/firebase-config.js before using coordinator tools."
        : "Could not sign out. Please refresh the page and try again.",
    );
  } finally {
    signOutButton.disabled = false;
    signOutButton.textContent = "Sign out";
  }
});

document.querySelector("#donor-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const validation = validateDonorSearch(new FormData(form));
  donorResults.replaceChildren();
  if (validation.error) {
    setStatus(searchStatus, validation.error);
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setStatus(searchStatus, "Searching...", "info");
  try {
    const donors = await searchDonors(validation.data.bloodGroup, validation.data.city);
    if (donors.length === 0) {
      setStatus(searchStatus, "No donors found for that blood group and city.", "info");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const donor of donors) fragment.append(createDonorResult(donor));
    donorResults.replaceChildren(fragment);
    setStatus(
      searchStatus,
      donors.length === 50
        ? "Showing the first 50 matches. Refine the city or contact your administrator for more results."
        : `${donors.length} ${donors.length === 1 ? "donor" : "donors"} found.`,
      "success",
    );
  } catch (error) {
    console.error("Donor search failed.", error);
    setStatus(
      searchStatus,
      !isFirebaseConfigured()
        ? "Firebase is not configured. Add the web app settings in src/firebase-config.js before searching."
        : error.code === "failed-precondition"
        ? "Search needs a Firestore index. Follow the index link in the Firebase error or see the setup guide."
        : error.code === "permission-denied"
          ? "Access denied. Confirm your coordinator account is active and the latest Firestore rules are published."
          : "Could not search donors. Check your connection and Firebase setup, then try again.",
    );
  } finally {
    submitButton.disabled = false;
  }
});

for (const form of document.querySelectorAll(".intake-form")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status");
    const submitButton = form.querySelector('[type="submit"]');
    const kind = form.dataset.kind;
    const validation = validators[kind](new FormData(form));

    if (validation.error) {
      status.textContent = validation.error;
      status.className = "form-status form-status-error";
      return;
    }

    if (!isFirebaseConfigured()) {
      status.textContent = "This form is not connected yet. Please try again after the site administrator finishes Firebase setup.";
      status.className = "form-status form-status-error";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    status.textContent = "";
    status.className = "form-status";

    try {
      await saveSubmission(kind === "donor" ? "donors" : "requests", validation.data);
      form.reset();
      status.textContent = kind === "donor"
        ? "Thank you for registering. Your details have been stored for coordinator review."
        : "Your request has been stored for coordinator review. For emergencies, contact your hospital directly.";
      status.className = "form-status form-status-success";
    } catch (error) {
      console.error("Could not submit the form to Firebase.", error);
      status.textContent = "We couldn't send your details. Please check your connection and try again, or contact the coordinator directly.";
      status.className = "form-status form-status-error";
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = kind === "donor"
        ? 'Register as a donor <span aria-hidden="true">↗</span>'
        : 'Send blood request <span aria-hidden="true">↗</span>';
    }
  });
}
