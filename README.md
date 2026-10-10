# IronDesk — How the Backend Connection Works

You already know HTML/CSS/JS from the Tic Tac Toe project. A backend adds
one new idea: **your page and your data now live in two separate programs**
that talk to each other over HTTP. This doc walks through that idea slowly.

## 1. The mental model

Before: your Tic Tac Toe game kept its board in a JavaScript variable in
the browser. Close the tab, the game is gone.

Now: `gym-management.html` doesn't store members itself anymore. It asks
`server.js` — a *separate program* — "give me the members," and `server.js`
answers by reading a file (`data.json`) on your computer. Close the tab,
the data is still there, because it never lived in the tab.

```
 your browser                          your computer (also)
┌───────────────────┐   HTTP request   ┌───────────────────┐
│ gym-management.html│ ───────────────▶ │   server.js        │
│ (frontend)          │ ◀─────────────── │   (backend)         │
└───────────────────┘   JSON response   └──────────┬──────────┘
                                                     │ reads/writes
                                                     ▼
                                              data.json (storage)
```

The frontend's only job now: display things, and ask the backend for data.
The backend's only job: guard the data, and hand it out to whoever proves
they're allowed to see it.

## 2. Setup (do this once)

You need [Node.js](https://nodejs.org) installed — if `node -v` in your
terminal prints a version number, you're set.

```bash
cd gym-app          # the folder with server.js in it
npm install          # downloads the two libraries server.js needs
```

`npm install` reads `package.json`, sees it needs `express` (a toolkit for
building servers) and `cors` (explained below), and downloads them into a
new `node_modules` folder.

## 3. Running it

You need **two things running at once** — this trips up almost every
beginner, so it's worth saying plainly:

1. **The backend**, in a terminal: `node server.js` — leave this running.
   You'll see `IronDesk backend running at http://localhost:3000`.
2. **The frontend** — just open `login.html` in your browser (double-click
   it, or drag it into a browser window).

Log in with `admin` / `gym123`. If the backend isn't running, you'll see a
toast saying "Can't reach the backend" — that's your signal to go check the
terminal from step 1.

## 4. Reading server.js top to bottom

Open `server.js` alongside this. Every route follows the same shape:

```js
app.post("/api/members", requireAuth, (req, res) => {
  // ... do something with req.body ...
  res.json(someResult);
});
```

- `app.post(...)` — "when a POST request hits `/api/members`, run this."
  `get`/`post`/`delete` mirror what the action *means*: get = read,
  post = create, delete = remove.
- `requireAuth` — runs first, checks the visitor has a valid login token.
  If not, it stops the request cold with a 401 error, before your route
  code even runs.
- `req` — the incoming request. `req.body` is whatever JSON the frontend
  sent. `req.params.id` is a value from the URL itself (`/api/members/5`
  → `req.params.id` is `"5"`).
- `res` — how you respond. `res.json(data)` sends JSON back.
  `res.status(400).json({error: "..."})` sends an error with a status code.

## 5. Reading the frontend's fetch calls

Every place the HTML file talks to the backend looks like this pattern
(from `addMember` in `gym-management.html`):

```js
fetch(API_URL + "/api/members", {
  method: "POST",
  headers: authHeaders(),
  body: JSON.stringify({ name: name, phone: phone, plan: planId, expires: expires })
})
  .then(handleResponse)
  .then(function () { /* success */ })
  .catch(handleNetworkError);
```

- `fetch(url, options)` sends the HTTP request.
- `JSON.stringify(...)` turns a JS object into text, because HTTP requests
  carry text, not live objects. On the other end, `express.json()`
  middleware turns that text back into `req.body`.
- `.then` runs once the response arrives. `.catch` runs if the network
  itself fails (server not running, no internet, etc).

## 6. Tokens — how the backend knows who you are

HTTP is stateless: the server doesn't remember you between requests unless
you remind it. That's what the token does.

1. You log in → server generates a random token, remembers it, sends it back.
2. Frontend saves it: `localStorage.setItem("token", ...)` — this is
   browser storage that survives page reloads.
3. Every future request attaches it: `"Authorization": "Bearer " + token`.
4. `requireAuth` on the server checks that header before doing anything.

This is why `logout()` just deletes the token from `localStorage` and
sends you back to `login.html` — no token, no access.

**Careful:** the current setup is intentionally simple for learning. The
admin password is hardcoded in `server.js`, and tokens reset if you
restart the server (everyone gets logged out). That's fine for a school
project. For anything real, you'd hash passwords (e.g. with `bcrypt`) and
use a proper database instead of `data.json`.

## 7. What CORS is (and why it's there)

Browsers block a page from calling a server on a different origin (a
different domain or port) unless that server explicitly allows it — this
stops malicious sites from silently reading your bank's API, for example.
`app.use(cors())` in `server.js` tells the browser "it's fine, let
requests from anywhere reach me." You'll hit CORS errors constantly once
you build more backend projects — now you know what they mean.

## 8. Where to go next

- Try adding a new field to members (e.g. an "email" input) — you'll need
  to touch three places: the HTML form, the `POST /api/members` route in
  `server.js`, and the table row in `renderMembers()`.
- Try adding a second admin account, or a `PUT /api/members/:id` route to
  *edit* a member instead of only add/delete.
- When you're ready for the "real" version of storage, look into SQLite —
  it's a single-file database, a small step up from `data.json`.
