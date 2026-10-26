// 1. Connect this page to the class project with its public browser key.
const PROJECT_URL = "https://wwabqgzfamogonzqblng.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_J7O2Bhhrhzd8xhijPWZREA_7lfXE0Wv";
const supabaseClient = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
window.supabaseClient = supabaseClient;

// 2. Keep the page controls and signed-in user's chat state together.
const loginScreen = document.querySelector("#loginScreen");
const chatScreen = document.querySelector("#chatScreen");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const authMessage = document.querySelector("#authMessage");
const welcomeText = document.querySelector("#welcomeText");
const logoutButton = document.querySelector("#logoutButton");
const messageList = document.querySelector("#messages");
const messageCount = document.querySelector("#message-count");
const chatStatus = document.querySelector("#chatStatus");
const form = document.querySelector("#message-form");
const input = document.querySelector("#message-input");
const sendButton = form.querySelector("button");
let currentUser = null;
let currentName = "Classmate";
let messageChannel = null;
const visibleMessages = new Map();
const profileNames = {};
const privateReplies = [];

// 3. Use textContent for status and names that may come from a user or server.
function showStatus(element, text) {
  element.textContent = text;
}

function showLogin() {
  loginScreen.hidden = false;
  chatScreen.hidden = true;
}

function nameFromUser(user) {
  return user.user_metadata?.display_name || user.email || "Classmate";
}

function showChat(user) {
  currentUser = user;
  currentName = nameFromUser(user);
  welcomeText.textContent = `Signed in as ${currentName}`;
  loginScreen.hidden = true;
  chatScreen.hidden = false;
  showStatus(authMessage, "");
  startChat();
}

// 4. Sign up with a display name stored in Auth user metadata for the trigger.
signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const displayName = document.querySelector("#displayName").value.trim();
  const email = document.querySelector("#signupEmail").value.trim();
  const password = document.querySelector("#signupPassword").value;

  if (displayName.length < 2 || displayName.length > 24) {
    showStatus(authMessage, "Display name must be 2 to 24 characters.");
    return;
  }
  if (password.length < 8) {
    showStatus(authMessage, "Password must be at least 8 characters.");
    return;
  }

  showStatus(authMessage, "Creating your account...");
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) {
    showStatus(authMessage, error.message);
  } else if (data.session) {
    showChat(data.user);
  } else {
    showStatus(authMessage, "Check your email to finish signing up.");
  }
});

// 5. Log in with the email and password entered in the form.
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;
  showStatus(authMessage, "Logging in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showStatus(authMessage, error.message);
    return;
  }
  showChat(data.user);
});

// 6. Sign out and restore the saved session when the page opens again.
logoutButton.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showStatus(chatStatus, error.message);
    return;
  }
  if (messageChannel) await supabaseClient.removeChannel(messageChannel);
  messageChannel = null;
  currentUser = null;
  visibleMessages.clear();
  privateReplies.length = 0;
  loginForm.reset();
  showLogin();
});

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showStatus(authMessage, error.message);
    showLogin();
  } else if (data.session) {
    showChat(data.session.user);
  } else {
    showLogin();
  }
}

restoreSession();

async function startChat() {} 
