# Virtual NASCAR (commissioner app)

The desktop app for running **Virtual NASCAR**, your NR2003 league across the Cup, O'Reilly Auto Parts, Craftsman Truck and ARCA Menards series. You import your NR2003 races here, write or generate news, and the app keeps your public league website up to date by itself.

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
6. Click that run, scroll down to **Artifacts**, and click **Virtual-NASCAR-Setup**. A zip downloads. Open it and run **Virtual-NASCAR-Setup-3.6.0.exe**.
7. Windows will probably say **"Windows protected your PC"** because the app is not from a big company. Click **More info**, then **Run anyway**. Install it like any other program. A **Virtual NASCAR** shortcut appears on your desktop.

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

If GitHub has a hiccup, the app tries again by itself (the dot at the bottom left says when), or click **Try now**. Use **Copy link** in Settings to share it. The first time can take a few minutes to appear. After that, every change goes up on its own and shows on the site **about 1 to 2 minutes later**. The dot at the bottom of the sidebar tells you if the site is up to date.

If GitHub ever needs the token replaced (they expire), make a new one the same way and paste it in Settings.

---

## New in 3.0

- **New name and look.** Virtual NASCAR, with the league's own logo and a badge for each series. Your old leagues, photos and keys carry over (the app keeps using the same data folder). The old "JSS Commissioner" shortcut is replaced by "Virtual NASCAR" when you install.
- **ARCA Menards Series** is the 4th series.
- **Seasons.** League page: **Finish season, start next** moves a season to past seasons and starts the next one with the same league, fans and settings. **Cancel season** ends one early (kept, marked cancelled). Past seasons can be opened or deleted, and visitors can browse them on the website with the season picker at the top.
- **Points systems.** League page: the 2026 Chase (55 for a win, no win-and-in), the 2017-2025 stage era, 2016, 2011-2015, the 2007-2010 and 2004-2006 Chase eras, Winston Cup 1975-2003, two ARCA systems, one point per car beaten, or your own list with lap-led bonuses. **Save and re-score** applies it to races already run. (Stage points are not counted: NR2003 has no stages.)
- **Schedule templates.** Edit Schedule: load the real 2026 or 2027 schedule for any series, with race names, tracks, dates, start times (Eastern) and TV/streaming filled in, or save your own. The schedule page shows times and channels.
- **News outlets.** Speedway Herald (race coverage), The Garage Insider (silly season) and The Pit Board (analysis). Rename them, their taglines and writers on the League page. Story pages now have a big header, pull quotes, key moments, "by the numbers", takeaways, "what's next", a race box and more from the same outlet.

## New in 3.5

- **Full-time now follows the real 2026 points standings.** A driver is full-time in a series when they race for that series' points and started at least 3 of every 4 races. For example, Austin Green, Mason Maggio, Josh Williams and Garrett Smithley are part-time in the O'Reilly series, Joey Gase is full-time, and Austin Hill is part-time in Cup (he races for O'Reilly points). About 70 more real part-timers are known, so they never count as full-time by mistake. In your own league, anyone who has run nearly every race stays full-time.
- **Career Moves** (commissioner bar):
  - **Shared cars this week:** pick who drives each shared car at the next race. When you import, the app puts that driver in the car, because NR2003 only shows one name. You can switch this off on the import screen with **Keep NR2003's names**. Auto-sim does it too.
  - **Call-ups:** ARCA standouts get 2 to 4 Truck starts, Truck drivers get O'Reilly starts, O'Reilly drivers get Cup starts, all in part-time cars. Those starts never count in the series above's points.
  - **Next season's moves:** suggested from results, contracts, happiness and how each team sees its driver, plus the real 2027 moves already announced. That means promotions up a series (a few rookies a year), new teams, re-signings, retirements, drivers sent down after a bad year, and fallouts where a team releases a driver, at season end or right away (an interim driver takes the car). Pick **How often teams fall out with drivers**. Owner-drivers and family teams are never fired or sent down; change that per driver on their page.
  - Nothing happens until you **Approve** it. Approved moves happen when you **Finish season, start next** on the League page. Released drivers and call-ups don't carry over, and most expiring deals re-sign.
- **Silly Season:** every predicted move shows its **top 3 landing spots** with a chance for each, including seats one series up or down. **Done deals** and **Call-ups** have their own sections, and the AI writers know about them.
- Driver pages show **Seat** security: how the team sees the driver (Valued, Secure, Under pressure, Hot seat).

## New in 3.4

- **Logos and Numbers** (commissioner bar): use your own pictures for car numbers and series logos.
  - **Car numbers:** drop a pile of pictures at once. Name each file after its car number (`24.jpg`, `#9.png`, `00-haas.png`) and it goes to that car by itself. Or use **Add picture** on any number, or **Another number** for one nobody drives yet. Each series keeps its own set, and a new season keeps them.
  - **Background:** "Remove a white background" (best for JPEGs) makes the white around the number see-through but keeps white inside the number. There is also "Remove a black background" and "Keep the background". Empty edges are trimmed and pictures are resized so they stay small.
  - Your number pictures replace the plain numbers in standings, race results, driver cards and pages, team pages, silly season, fan pages and The Garage, in the app and on the website.
  - **Series logos:** pick a picture for each series. It shows on the series tabs and story pictures. **Back to built-in** undoes it.
  - On the website the pictures are published as their own files, so pages stay fast.

## New in 3.3

- **Part-time cars.** Cars that several drivers share in real life (like the #1 Tricon truck: Corey Heim, Brandon Jones and Nick Leitz) are marked part-time. NR2003 only shows one driver per car, so when you import a race or a preseason test, the app brings in **all** the real drivers of that car as part-timers on the same team and number.
- **Points are for full-time drivers.** Part-timers are left out of the championship standings and The Chase. They get their own **Part-time drivers** table under the standings (purple **PT** tag), and they are tagged on race results, driver pages, team pages and the silly season page. Their finishes still count in race results.
- **Make a car full-time for one driver.** Teams and Contracts (or the commissioner box on a driver's page): switch anyone between **Full-time (in points)** and **Part-time (not in points)**. The real roster never undoes your choice, so a silly season move sticks. Silly season also flags part-timers who are looking for a full-time ride.
- In a league that already has races, anyone who ran nearly every race stays full-time, whatever the real roster says.

## New in 3.2

- **Fan accounts that look real.** Handles follow real patterns (names, initials, birth years, home states, trucks, football teams) and X/Reddit rules. Every fan has a profile page (bio, hometown, join date, followers, who they cheer for or against, all their posts). Media personalities have profiles too.
- **Fanbases** tab in The Garage: a love/hate bar for every driver, and each driver's superfans, fans, haters and superhaters.
- **Regenerate the AI people** (Garage Tools): new identities for all fans (optionally new favorite drivers), or new media personalities. Then run Refresh everything to rewrite their posts.
- **Drivers and Teams pages** with car numbers, results, a contract bar and a happiness bar (worked out from results, teammates, contract years and rumors, with the reasons listed). Teams and car numbers fill in from the real 2026 rosters; change anything in **Teams and Contracts** (commissioner bar).
- **Silly Season** page: predicted moves with chances and likely landing spots, the contract tracker, the rumor board, and rising stars from the series below. The silly season writer now knows contracts, moods and the other series, so ARCA standouts get linked to Truck seats and so on. The home page has an "Around Virtual NASCAR" strip with headlines from the other series.
- **Preseason test** (Import, "Preseason test"): import a test session before the season. It never counts in the standings; it teaches the app the roster and the newsroom writes preseason stories (expectations, test report, contract years to watch) and fans start talking.
- **Auto-sim** (Import page): race the next round without NR2003. Results come from each driver's season form at that kind of track plus practice and qualifying, with wrecks and laps led, and it gets full AI coverage.
- The Truck Series is called the **FedEx Freight Truck Series** from the 2027 season on.

---

## Using the app

| Page | What it is for |
|---|---|
| **Import Results** | Pick **Race results**, **Qualifying**, **Practice** or **Happy Hour**. Drop the NR2003 standings file from `exports_imports`, paste a list, or use a **screenshot** of the results screen (needs the AI key; check the names it read). Race results update the standings and the AI writes the recap. Practice and qualifying never touch the standings; they put the drivers in the field, get the fans hyping the race, show on the site and feed the Race Outlook. |
| **Story Studio** | Drop race screenshots or replay clips, write a headline and what happened. For hype stories, pick any upcoming race under **Preview: before a race**. The AI writes a preview that never makes up a result, and the story is dated the morning of that race. Race recaps are dated that race night. Pick an outlet: **Checkered Wire** (race coverage), **Silly Season Daily** (contracts and rumors) or **Pit Notes** (analysis). The AI writes it, you edit, then publish. |
| **Races** | Rename, change the date (its stories and fan posts move with it), change how points are scored, or remove a race. Practice and qualifying you imported are listed here too. |
| **Edit Schedule** | Race names, tracks, **track types** (the track type is what the Race Outlook uses) and dates. Give every race its own weekend: a yellow note shows when two races share a day, because their stories and fan posts would get mixed together. |
| **League** | League name, playoff size and cut-off race, the note on the home page, backups. |
| **Garage Tools** | Refresh fan chatter between races, **Run the newsroom** for fresh stories (pick a race to get previews dated that race morning, or "This week"), see and change silly season storylines, **Refresh everything** (rewrites the whole season's fan posts and newsroom stories in the newest style, weekend by weekend, and can be stopped and continued), add or replace fan accounts, nudge a driver's reputation, delete posts. |
| **Settings** | Dark or light look for the app, AI key (Gemini free or Claude paid), whether the newsroom writes its own stories, website connection. |
| **Preview public site** | See exactly what visitors see. |

The **Series** box in the sidebar switches between Cup, O'Reilly Auto Parts and Truck. Each one is its own league with its own schedule, standings, news and fans. Visitors get the same box on the website once more than one series has races.

**Videos:** clips up to 40 MB go on the website. Bigger ones stay in the app and the site shows a still frame from them. You can paste a YouTube link under a big clip and the site will link to it.

**Backups:** League page, **Download backup**. It holds every series, story, fan and photo. It never holds your AI key or GitHub token, so it is safe to keep anywhere.

**Where your data lives:** on your PC, in the app's data folder (**File** menu, **Open data folder**). Your AI key and GitHub token are stored encrypted by Windows.

---

## What visitors see

- **A big-series-site layout.** Series tabs across the top, a main menu, a home page with the next race (time and TV), the lead story, results, standings and schedule. Dark by default, light on request.
- **A Settings tab** where each visitor can switch to light mode, or have it follow their phone or computer. It is saved on their device only.
- **Standings** show **+/- Cut**: how many points each driver is above or below the Chase cut line, with a red line where the cut falls, an "On the bubble" box, and a **Chase grid** tab that shows the field as if it were set today.
- **The Garage** has about 140 fan accounts with realistic handles, 10 media personalities (reporter, YouTuber, analyst, radio host, insider, stats account, podcast, streamer, ex-crew chief, memes), quote posts and polls.
- **News** comes from three outlets, each with its own logo. After every import the newsroom writes previews and analysis on its own (you can turn this off in Settings).
- **Silly season follows the real NASCAR calendar.** Early in the year it is quiet whispers, rumors and talks build through spring, most deals get confirmed in summer before the playoffs, it goes quiet during championship week, and the offseason brings crew chief swaps and new sponsors. Each rumor moves step by step (whisper, rumor, talks, close to a deal, confirmed, or falls through), and the News page shows a **Silly season board** with where every storyline stands.
- **Fans and media talk like real NASCAR people at each point of the season.** Overreactions early, power rankings and grudges in the middle, bubble watch starting about four races before the cut, nothing but the cut on cut-race week, elimination math in the playoffs, title picks in championship week and offseason arguments after.
- **The AI avoids repeating itself.** It keeps track of phrases fans and writers have worn out and is told not to use them again, and near-copies of earlier posts are thrown out.

---

## Updating the app later

When you get a new version:

1. Unzip it and copy **everything inside** into your **jss** folder, replacing the old files when Windows asks.
2. In **GitHub Desktop**, type **Update app** in the Summary box (bottom left), click **Commit to main**, then click **Push origin** at the top.
3. On github.com, open the **Actions** tab, wait for the green check, click the newest run, and download **Virtual-NASCAR-Setup** under Artifacts.
4. Run the new installer. It replaces the old app. Your leagues, stories, settings and keys stay.

The website updates itself the next time the app publishes.

---

## Good to know

- Everything written by the AI (articles, quotes, fan posts) is labeled as fictional on the site. Drivers use real NASCAR names because the NR2003 mod does, so the site keeps those labels on purpose.
- The website is just files on GitHub. There is no server to pay for and nothing to keep running.
- The odds in the Chase, Race and Season outlooks come from the app's own race simulator (thousands of simulated races using your league's results), not from the AI. The AI only writes the commentary around them. Early in the season the numbers jump around a lot. That is normal.
