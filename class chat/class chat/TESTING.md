# Manual test checklist

The guide says its `chatter` project already has its tables, trigger, privileges, RLS policies, and Realtime publication configured. The connection values now supplied for this answer key point to a different project, and its setup status has not been verified. This local answer key has not been run against either live project.

## Dashboard steps to do yourself

1. Open the Supabase project whose URL is in `script.js`. Restore it if it is paused.
2. **A3:** In **Authentication → Sign In / Providers → Email** (older dashboards: **Providers → Email**), turn **Confirm email** off. This lets class sign-ups enter without sending confirmation emails.
3. **A4:** In the Email provider settings, set the **minimum password length** to `8`. Keep anonymous sign-ins off.
4. Make sure new user sign-ups are enabled while students register.
5. Verify the Project URL and Publishable key in the student's `script.js`. Post those two public connection values as plain text in Google Classroom.

The guide's prepared-project statement applies to the project named `chatter` in Part A. Because the supplied connection URL is different, confirm whether the project configured in `script.js` has the setup. If it is a fresh project, run `supabase-setup.sql` in **SQL Editor → New query**; the script is safe to repeat. If it was separately prepared, check that setup before running the app.

## Optional: 10-minute dashboard tour for students

1. **SQL Editor (2 minutes).** Show `supabase-setup.sql` and explain that it creates the tables, trigger, grants, policies, and Realtime publication. **Expected:** the instructor has run it for the project configured in `script.js` if that project was not already prepared; students observe the setup rather than running it.
2. **Table Editor → `messages` (3 minutes).** Have a student send one normal message while the table is open. **Expected:** a new row appears; `content` contains the message, and `user_id` is filled from the signed-in user's token by the database default. The browser insert in `script.js` sends only `{ content }`.
3. **Authentication → Users (2 minutes).** Show the new account. **Expected:** the user appears, but there is no password field to inspect. Supabase stores passwords as hashes; students should never expect to read a password back from the dashboard.
4. **Authentication → Policies (3 minutes).** Read `messages_insert_own` aloud: `WITH CHECK (user_id = auth.uid())`. Connect it to `supabaseClient.from("messages").insert({ content })` in `script.js`: the database supplies `user_id`, and the policy permits the row only when its owner matches the signed-in user.

## App checklist

- [ ] Open `index.html` with VS Code Live Server. Expected: the login screen appears and the chat screen is hidden; the Activity 6 indigo chat design is retained.
- [ ] Sign up with an email, a throwaway password of at least 8 characters, and a 2–24 character display name. Expected: the chat screen shows the display name.
- [ ] Refresh the page. Expected: the existing session opens the chat screen again.
- [ ] Log out and log back in. Try a wrong password. Expected: log in works, and the wrong password produces a readable error.
- [ ] After login, confirm the header shows the profile display name and a log-out button. Expected: the sender picker is gone, so messages use the signed-in account.
- [ ] Sign up a second account in another browser or private window.
- [ ] Send a normal message. Expected: it appears on the right; in **Table Editor → messages**, only `content` was sent by the browser and the database filled `user_id` from the login token.
- [ ] Refresh after Part 2. Expected at that checkpoint: the message disappears until Part 3 adds history loading.
- [ ] With Part 3 complete, refresh. Expected: up to the latest 50 messages return oldest-first with display names from `profiles`.
- [ ] With Part 4 complete, send a message from the second account. Expected: it appears without refreshing. Your own message appears once. Delete your own row in Table Editor. Expected: it disappears on both screens.
- [ ] Type `/weather Manila`. Expected: a yellow `WeatherBot` bubble appears only in the sender's browser and disappears after refresh. The Network tab shows two Open-Meteo GET requests with no `apikey` or `Authorization` header.
- [ ] Type `/joke`. Expected: the Activity 6 `JokeBot` reply appears locally and is not saved to the shared message table.
- [ ] Try `/weather` with an unknown city and with the network unavailable. Expected: the app shows a readable not-found or service-unavailable reply; the command itself is never posted to the shared chat.
- [ ] Run Labs 1–6 from `security-labs.md`. Expected results are recorded beside each snippet. Lab 4 needs a message from the second account.

## Cleanup

- [ ] Delete test accounts in **Authentication → Users** when appropriate; their messages are removed by the foreign key cascade.
- [ ] To clear class messages between sections, review and then uncomment the final reset line in `supabase-setup.sql` and run it. Re-comment it afterward.
