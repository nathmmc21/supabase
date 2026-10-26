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

// 7. Build message bubbles from elements so chat text stays plain text.
function makeBubble(authorName, messageText, sentAt, ownMessage, weatherBot = false, id = "") {
  const item = document.createElement("li");
  item.className = "message";
  if (ownMessage) item.classList.add("mine");
  if (weatherBot) item.classList.add("weather-bot");
  if (id) item.dataset.messageId = String(id);

  const author = document.createElement("span");
  author.className = "author";
  author.textContent = authorName;
  const text = document.createElement("p");
  text.textContent = messageText;
  const time = document.createElement("time");
  const date = new Date(sentAt);
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  item.append(author, text, time);
  return item;
}

function renderMessages() {
  messageList.replaceChildren();
  const rows = [
    ...[...visibleMessages.values()].map((message) => ({ kind: "shared", message })),
    ...privateReplies.map((reply) => ({ kind: "private", message: reply }))
  ];
  rows.sort((a, b) => new Date(a.message.created_at || a.message.createdAt) -
    new Date(b.message.created_at || b.message.createdAt));

  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No messages yet. Say hello!";
    messageList.append(empty);
  }
  for (const row of rows) {
    const message = row.message;
    if (row.kind === "private") {
      messageList.append(makeBubble(message.author, message.content, message.createdAt,
        false, message.author === "WeatherBot"));
    } else {
      const author = profileNames[message.user_id] ||
        (message.user_id === currentUser?.id ? currentName : "Classmate");
      messageList.append(makeBubble(author, message.content, message.created_at,
        message.user_id === currentUser?.id, false, message.id));
    }
  }
  messageCount.textContent = `${rows.length} message${rows.length === 1 ? "" : "s"}`;
  messageList.scrollTop = messageList.scrollHeight;
}

function showMessage(message) {
  const key = String(message.id);
  if (visibleMessages.has(key)) return;
  visibleMessages.set(key, message);
  renderMessages();
}

function showPrivateReply(author, content) {
  privateReplies.push({ author, content, createdAt: new Date().toISOString() });
  renderMessages();
}

// 8. Check local commands before inserting; normal messages send only content.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || !currentUser) return;
  sendButton.disabled = true;

  try {
    if (await handleCommand(content)) {
      input.value = "";
      showStatus(chatStatus, "");
      return;
    }
    showStatus(chatStatus, "Sending...");
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({ content })
      .select("id, content, user_id, created_at")
      .single();
    if (error) {
      showStatus(chatStatus, error.message);
      return;
    }
    showMessage(data);
    input.value = "";
    showStatus(chatStatus, "");
    input.focus();
  } catch (error) {
    showStatus(chatStatus, error.message || "The message could not be sent.");
  } finally {
    sendButton.disabled = false;
  }
});

// 9. Load profile names and the newest 50 rows, then show them oldest-first.
async function loadNames(userIds) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", uniqueIds);
  if (error) throw error;
  for (const profile of data) profileNames[profile.user_id] = profile.display_name;
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, content, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    showStatus(chatStatus, error.message);
    return;
  }
  try {
    await loadNames(data.map((message) => message.user_id));
    for (const message of data.reverse()) {
      if (!visibleMessages.has(String(message.id))) {
        visibleMessages.set(String(message.id), message);
      }
    }
    renderMessages();
    showStatus(chatStatus, "");
  } catch (error) {
    showStatus(chatStatus, error.message);
  }
}

async function loadCurrentName() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("display_name")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) {
    showStatus(chatStatus, error.message);
  } else if (data) {
    currentName = data.display_name;
    profileNames[currentUser.id] = currentName;
    welcomeText.textContent = `Signed in as ${currentName}`;
    renderMessages();
  }
}

// 10. Listen for inserts and deletes while this classmate is signed in.
function removeMessage(messageId) {
  if (visibleMessages.delete(String(messageId))) renderMessages();
}

async function showRealtimeMessage(message) {
  try {
    await loadNames([message.user_id]);
    showMessage(message);
  } catch (error) {
    showStatus(chatStatus, error.message);
  }
}

function subscribeToMessages() {
  if (messageChannel) supabaseClient.removeChannel(messageChannel);
  messageChannel = supabaseClient.channel("class-chat-messages")
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages"
    }, (payload) => showRealtimeMessage(payload.new))
    .on("postgres_changes", {
      event: "DELETE", schema: "public", table: "messages"
    }, (payload) => removeMessage(payload.old.id))
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        showStatus(chatStatus, "Live updates could not connect.");
      }
    });
}

async function startChat() {
  visibleMessages.clear();
  privateReplies.length = 0;
  renderMessages();
  subscribeToMessages();
  await Promise.all([loadMessages(), loadCurrentName()]);
}

// 11. Keep Activity 6's /joke command local to the person who types it.
async function handleCommand(text) {
  const commandMatch = text.match(/^\/(weather|joke)(?:\s|$)/i);
  if (!commandMatch) return false;
  const command = commandMatch[1].toLowerCase();
  if (command === "joke") {
    showPrivateReply("JokeBot", "ano tawag sa aso na laging nasa inuman? edi pulutan");
    return true;
  }
  const city = text.slice("/weather".length).trim();
  if (!city) {
    showPrivateReply("WeatherBot", "Try it like this: /weather Manila");
  } else {
    await getWeather(city);
  }
  return true;
}

// 12. Ask Open-Meteo for the city, then its current forecast with two GETs.
async function getWeather(city) {
  try {
    const geoUrl = "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) throw new Error("Geocoding request failed.");
    const geoData = await geoResponse.json();
    if (!geoData.results || geoData.results.length === 0) {
      showPrivateReply("WeatherBot", `Sorry, I could not find ${city}.`);
      return;
    }

    const place = geoData.results[0];
    const forecastUrl = "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: place.latitude,
        longitude: place.longitude,
        current: "temperature_2m,weather_code",
        timezone: "auto"
      });
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) throw new Error("Forecast request failed.");
    const forecastData = await forecastResponse.json();
    const current = forecastData.current;
    const placeName = [place.name, place.country].filter(Boolean).join(", ");
    const reply = `${placeName}: ${Math.round(current.temperature_2m)} °C, ` +
      `${describeWeather(current.weather_code)}.`;
    showPrivateReply("WeatherBot", reply);
  } catch (error) {
    showPrivateReply("WeatherBot", "Sorry, the weather service is not answering right now.");
  }
}

function describeWeather(code) {
  if (code === 0) return "clear sky";
  if (code === 1) return "mainly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown conditions";
}
