# Security Labs 1–6

Open the browser DevTools Console while the app is running. Use only your own class account and this class project. Labs 2 and 4 need a second account with at least one message. Lab 5 sends a literal test string to the class chat.

## Lab 1 — Logged out

```js
await supabaseClient.auth.signOut();
const result = await supabaseClient.from("messages").select("*");
console.log(result);
```

**Expected:** No messages are returned. Expect a permission error (code `42501`) or possibly an empty list. A logged-out visitor has no privileges, and RLS also requires a login.

## Lab 2 — Impersonate

```js
const { data: { user } } = await supabaseClient.auth.getUser();
const { data: profiles } = await supabaseClient.from("profiles").select("user_id");
const otherProfile = profiles.find((profile) => profile.user_id !== user.id);
if (!otherProfile) {
  console.log("Expected setup: create a second account first.");
} else {
  const result = await supabaseClient.from("messages").insert({
    content: "Trying to post as another user",
    user_id: otherProfile.user_id
  });
  console.log(result.error);
}
```

**Expected:** The insert fails with a row-level security policy error (code `42501`). The insert policy requires `user_id` to match the id in the login token.

## Lab 3 — Too long

```js
const result = await supabaseClient.from("messages").insert({
  content: "x".repeat(600)
});
console.log(result.error);
```

**Expected:** A check constraint error (code `23514`). The database enforces the 500-character limit even when the browser chat box is bypassed.

## Lab 4 — Delete another user's message

```js
const { data: { user } } = await supabaseClient.auth.getUser();
const { data: otherMessage } = await supabaseClient
  .from("messages")
  .select("id, user_id")
  .neq("user_id", user.id)
  .limit(1)
  .maybeSingle();
if (!otherMessage) {
  console.log("Expected setup: send a message from a second account first.");
} else {
  const result = await supabaseClient
    .from("messages")
    .delete()
    .eq("id", otherMessage.id)
    .select();
  console.log(result);
}
```

**Expected:** The result has `data: []` and no error. RLS hides the other user's row, so nothing is deleted. Deleting your own message works, and Realtime removes it on other screens.

## Lab 5 — Injection

```js
const result = await supabaseClient.from("messages").insert({
  content: "<img src=x onerror=alert('XSS')>"
});
console.log(result.error || "Sent. Look at the chat bubble.");
```

**Expected:** The string appears as plain text and no alert appears because the app uses `textContent`. With `innerHTML`, the injected event handler could run in every classmate's browser.

## Lab 6 — Token

```js
const { data } = await supabaseClient.auth.getSession();
const token = data.session.access_token;
const tokenPart = token.split(".")[1];
const base64 = tokenPart.replace(/-/g, "+").replace(/_/g, "/");
const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
console.log(JSON.parse(atob(padded)));
```

**Expected:** The decoded object includes `sub` (the user id used by `auth.uid()`), `role: "authenticated"`, `email`, and `exp` (expiry). The token is signed, so editing it makes it invalid. Decode it in DevTools only; never paste a token into a website.

**Expected Network tab note:** Supabase requests carry an `apikey` header with the publishable key and an `Authorization` header with the login token. Anyone can see the publishable key; RLS protects the data.
