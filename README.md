# JSS Commissioner

The desktop app for running **Jet's Sim Series**. You import your NR2003 races here, write or generate news, and the app keeps your public league website up to date by itself.

- **The app** (this) is for you, the commissioner.
- **The website** is what everyone else sees. It updates on its own about 1 to 2 minutes after you change something.

---

## Part 1: Get the app onto your PC (about 10 minutes, one time)

You need a free GitHub account. GitHub builds the Windows installer for you, and later it also hosts your website.

1. Go to **github.com** and sign up (free).
2. Click the **+** at the top right, then **New repository**.
   - Name: **jss**
   - Pick **Public** (the free website only works with public repositories)
   - Click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Open the **jss-app** folder on your PC, select **everything inside it** (the `src`, `build` and `.github` folders and all the files), and drag it all onto the GitHub page. Click **Commit changes**.
   - If you do not see the `.github` folder, in File Explorer click **View**, then **Show**, then **Hidden items**. It must be uploaded too, because it holds the build instructions.
5. Click the **Actions** tab at the top of your repository. You will see **Build the Windows app** running (yellow dot). Wait about 5 minutes for a green check.
6. Click that run, scroll down to **Artifacts**, and click **JSS-Commissioner-Setup**. A zip downloads. Open it and run **JSS-Commissioner-Setup-1.0.0.exe**.
7. Windows will probably say **"Windows protected your PC"** because the app is not from a big company. Click **More info**, then **Run anyway**. Install it like any other program. A **JSS Commissioner** shortcut appears on your desktop.

> **Prefer not to use GitHub for the installer?** Install Node.js from nodejs.org, open the jss-app folder, type `cmd` in the address bar and press Enter, then type `npm install` and then `npm start`. The app opens. Use `npm run dist` to make the installer yourself (it lands in the `dist` folder).

---

## Part 2: Turn on the AI writing (free, about 3 minutes)

The news stories, the fan chatter in The Garage and the outlook commentary are written by AI. The app uses **Google Gemini** by default, which has a free daily allowance and needs **no credit card**.

1. Go to **aistudio.google.com** and sign in with a Google account.
2. Click **Get API key**, then **Create API key**, and copy it.
3. In the app, open **Settings**. Make sure **Gemini (free)** is selected, paste the key into **Gemini API key**, and click **Test key**. You should see "The key works."

A race import uses about 3 requests, well inside the free allowance. If you ever hit the daily limit, the app switches to Google's lighter free model, and if that runs out too it tells you to try again the next day (it resets overnight). Google may use what you send on the free plan to improve its products, so keep personal information out of your story notes.

**Want the best writing instead?** Pick **Claude (paid)** in Settings and use a key from console.anthropic.com. It costs about 10 to 15 cents per race.

Without any key the app still works. Each race just gets a short, plain automatic recap and The Garage stays quiet.

---

## Part 3: Turn on your public website (about 5 minutes)

1. On GitHub, click your profile picture (top right), then **Settings**, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, **Generate new token**.
2. Name it anything. Set **Expiration** to the longest it allows.
3. Under **Repository access**, choose **Only select repositories** and pick **jss**.
4. Under **Permissions**, find **Contents** and set it to **Read and write**. That is the only permission it needs.
5. Click **Generate token** and copy it (it starts with `github_pat_`).
6. In the app, open **Settings**. Under **Public website**, type your GitHub username, `jss` as the repository, paste the token, and click **Save and connect**. The app builds your site.
7. One time only: on GitHub, open your **jss** repository, click **Settings**, then **Pages** (left side). Under **Branch**, pick **gh-pages** and **/ (root)**, then click **Save**.

Your link looks like:

**https://YOURNAME.github.io/jss/**

Use **Copy link** in Settings to share it. The first time can take a few minutes to appear. After that, every change goes up on its own and shows on the site **about 1 to 2 minutes later**. The dot at the bottom of the sidebar tells you if the site is up to date.

If GitHub ever needs the token replaced (they expire), make a new one the same way and paste it in Settings.

---

## Using the app

| Page | What it is for |
|---|---|
| **Import Race** | Drop the standings file NR2003 saves in `exports_imports` (the .html file). Check the preview, click Import. The AI writes the recap and the fans react. |
| **Story Studio** | Drop race screenshots or replay clips, write a headline and what happened. Pick an outlet: **Checkered Wire** (race coverage), **Silly Season Daily** (contracts and rumors) or **Pit Notes** (analysis). The AI writes it, you edit, then publish. |
| **Races** | Rename, change the date, change how points are scored, or remove a race. |
| **Edit Schedule** | Race names, tracks and **track types** (the track type is what the Race Outlook uses). |
| **League** | League name, playoff size and cut-off race, the note on the home page, backups. |
| **Garage Tools** | Refresh fan chatter between races, add or replace fan accounts, nudge a driver's reputation, delete posts. |
| **Settings** | AI key (Gemini free or Claude paid), website connection. |
| **Preview public site** | See exactly what visitors see. |

The **Series** box in the sidebar switches between Cup, Xfinity and Truck. Each one is its own league with its own schedule, standings, news and fans. Visitors get the same box on the website once more than one series has races.

**Videos:** clips up to 40 MB go on the website. Bigger ones stay in the app and the site shows a still frame from them. You can paste a YouTube link under a big clip and the site will link to it.

**Backups:** League page, **Download backup**. It holds every series, story, fan and photo. It never holds your AI key or GitHub token, so it is safe to keep anywhere.

**Where your data lives:** on your PC, in the app's data folder (**File** menu, **Open data folder**). Your AI key and GitHub token are stored encrypted by Windows.

---

## Updating the app later

When you get a new version:

1. Unzip it and copy **everything inside** into your **jss** folder, replacing the old files when Windows asks.
2. In **GitHub Desktop**, type **Update app** in the Summary box (bottom left), click **Commit to main**, then click **Push origin** at the top.
3. On github.com, open the **Actions** tab, wait for the green check, click the newest run, and download **JSS-Commissioner-Setup** under Artifacts.
4. Run the new installer. It replaces the old app. Your leagues, stories, settings and keys stay.

The website updates itself the next time the app publishes.

---

## Good to know

- Everything written by the AI (articles, quotes, fan posts) is labeled as fictional on the site. Drivers use real NASCAR names because the NR2003 mod does, so the site keeps those labels on purpose.
- The website is just files on GitHub. There is no server to pay for and nothing to keep running.
- The odds in the Chase, Race and Season outlooks come from the app's own race simulator (thousands of simulated races using your league's results), not from the AI. The AI only writes the commentary around them. Early in the season the numbers jump around a lot. That is normal.
